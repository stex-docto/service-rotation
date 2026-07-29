import { describe, expect, it } from 'vitest'
import { computeAssignment } from './assign'
import { InfeasibleError, MatchingInput } from './types'

// Extends the "honesty wins" claim (see gamingResistance.test.ts on
// feature/fairness-explanation-page, and HowItWorksPage.tsx, which currently
// only cite the allowRepeatedServices: false case) to check it still holds —
// in fact strengthens — once repeats are allowed. Same generator as that
// file (serviceCount 4-7 always > rotations 2-3), which specifically
// exercises the regime where the per-pair repeat cap used to be silently
// forced back to 1 before the allowRepeatedServices fix (see assign.ts's
// perStudentServiceCap comment) — i.e. exactly the range this claim needs to
// keep holding once that feature ships.
//
// Once feature/allow-repeated-services and feature/fairness-explanation-page
// are both merged, fold this into gamingResistance.test.ts (or link it from
// HowItWorksPage.tsx) rather than keeping it as a separate file — it's split
// out for now only because the two features live on separate branches.
function mulberry32(seed: number) {
    let state = seed
    return function next(): number {
        state |= 0
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// The classic strategic-exaggeration move: collapse an honest graduated
// 0..4 vote to bipolar — see gamingResistance.test.ts.
function minMax(cost: number): number {
    return cost <= 2 ? 0 : 4
}

function ownServices(result: ReturnType<typeof computeAssignment>, studentId: string): string[] {
    return result.assignments.find(a => a.studentId === studentId)!.rotationServiceIds
}

// Score an assignment's services against the student's TRUE (honest) costs,
// regardless of which run (honest or min-maxed) produced that assignment —
// the only way to tell whether lying made the student genuinely better off,
// versus just changing the self-reported number.
function trueCostOf(honestGrades: Map<string, number>, services: string[]): number {
    return services.reduce((sum, id) => sum + (honestGrades.get(id) as number), 0)
}

function setsEqual(a: string[], b: string[]): boolean {
    const sa = new Set(a)
    const sb = new Set(b)
    return sa.size === sb.size && [...sa].every(x => sb.has(x))
}

interface SweepResult {
    comparable: number
    genuinelyBetter: number
    genuinelyWorse: number
    unchanged: number
    reallocated: number
    groupWorstIncreased: number
}

// One student min-maxes against otherwise-honest voters, scored against
// their true preferences — identical scenario/methodology to
// gamingResistance.test.ts, parameterised only on allowRepeatedServices so
// both branches of the comparison run through the exact same generator.
function runMinMaxSweep(allowRepeatedServices: boolean): SweepResult {
    const trials = 1000
    let comparable = 0
    let genuinelyBetter = 0
    let genuinelyWorse = 0
    let unchanged = 0
    let reallocated = 0
    let groupWorstIncreased = 0

    for (let trial = 0; trial < trials; trial++) {
        const rng = mulberry32(trial)
        const rotations = 2 + Math.floor(rng() * 2) // 2..3
        const serviceCount = 4 + Math.floor(rng() * 4) // 4..7 — always > rotations
        const studentCount = 5 + Math.floor(rng() * 6) // 5..10

        const services = Array.from({ length: serviceCount }, (_, i) => ({
            serviceId: `svc${i}`,
            capacityPerRotation: 2 + Math.floor(rng() * 3) // 2..4
        }))
        const lotteryOrder = Array.from({ length: studentCount }, (_, i) => `student${i}`)
        const honestStudents = lotteryOrder.map(studentId => ({
            studentId,
            costs: new Map(services.map(s => [s.serviceId, Math.floor(rng() * 5)])) // honest 0..4
        }))
        const honestInput: MatchingInput = {
            rotations,
            services,
            students: honestStudents,
            lotteryOrder,
            allowRepeatedServices
        }

        const victimId = lotteryOrder[Math.floor(rng() * studentCount)]
        const minMaxedStudents = honestStudents.map(s =>
            s.studentId === victimId
                ? {
                      studentId: s.studentId,
                      costs: new Map([...s.costs].map(([id, c]) => [id, minMax(c)]))
                  }
                : s
        )
        const minMaxedInput: MatchingInput = {
            rotations,
            services,
            students: minMaxedStudents,
            lotteryOrder,
            allowRepeatedServices
        }

        let honestResult, minMaxedResult
        try {
            honestResult = computeAssignment(honestInput)
            minMaxedResult = computeAssignment(minMaxedInput)
        } catch (error) {
            if (error instanceof InfeasibleError) continue
            throw error
        }

        comparable++
        const honestGrades = honestStudents.find(s => s.studentId === victimId)!.costs
        const honestServices = ownServices(honestResult, victimId)
        const minMaxedServices = ownServices(minMaxedResult, victimId)

        if (!setsEqual(honestServices, minMaxedServices)) reallocated++

        const trueCostHonestRun = trueCostOf(honestGrades, honestServices)
        const trueCostMinMaxedRun = trueCostOf(honestGrades, minMaxedServices)
        const trueDelta = trueCostMinMaxedRun - trueCostHonestRun
        if (trueDelta < 0) genuinelyBetter++
        else if (trueDelta > 0) genuinelyWorse++
        else unchanged++

        if (minMaxedResult.worstCost > honestResult.worstCost) groupWorstIncreased++
    }

    return {
        comparable,
        genuinelyBetter,
        genuinelyWorse,
        unchanged,
        reallocated,
        groupWorstIncreased
    }
}

describe('gaming resistance with allowRepeatedServices', () => {
    it('reproduces gamingResistance.test.ts exactly when the flag is off', () => {
        // Sanity anchor: same generator, same pinned bounds as the committed
        // test on feature/fairness-explanation-page — confirms this file's
        // copy of the methodology hasn't drifted before trusting the
        // allowRepeatedServices: true comparison below.
        const result = runMinMaxSweep(false)

        expect(result.comparable).toBe(997)
        expect(result.genuinelyBetter).toBe(7)
        expect(result.groupWorstIncreased).toBe(94)
        expect(result.genuinelyWorse).toBeGreaterThanOrEqual(410)
        expect(result.genuinelyWorse).toBeLessThanOrEqual(435)
        expect(result.reallocated).toBeGreaterThanOrEqual(455)
        expect(result.reallocated).toBeLessThanOrEqual(480)
    })

    it('holds — and strengthens — once repeats are allowed', () => {
        const result = runMinMaxSweep(true)

        // The headline finding: gaming pays off in ZERO of the comparable
        // trials once repeats are allowed (down from 7/997 without), and
        // backfires slightly more often (444 vs 421) — a lied-about
        // "favourite" can now be repeated across every rotation instead of
        // just one, so a bad guess compounds instead of being diluted across
        // otherwise-honest picks.
        expect(result.comparable).toBe(999)
        expect(result.genuinelyBetter).toBe(0)
        expect(result.genuinelyWorse).toBe(444)
        expect(result.unchanged).toBe(555)
        expect(result.reallocated).toBe(481)

        // Repeats relieve capacity pressure generally, so a liar distorting
        // the network is far less able to displace someone else from a
        // scarce distinct slot — group worst-case harm drops sharply (94 ->
        // 11) rather than growing.
        expect(result.groupWorstIncreased).toBe(11)
        expect(result.groupWorstIncreased).toBeLessThan(94)

        expect(result.genuinelyBetter + result.genuinelyWorse + result.unchanged).toBe(
            result.comparable
        )
    })
})
