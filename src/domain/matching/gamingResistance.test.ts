import { describe, expect, it } from 'vitest'
import { computeAssignment } from './assign'
import { InfeasibleError, MatchingInput } from './types'

// Deterministic PRNG (mulberry32) so this sweep reproduces byte-for-byte —
// see assign.test.ts's property test for the same convention.
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
// 0..4 vote to bipolar. Anything you'd rate "acceptable" (<=2) becomes an
// enthusiastic 0 (claim to love it); anything else becomes the worst
// possible 4 (claim to hate it).
function minMax(cost: number): number {
    return cost <= 2 ? 0 : 4
}

function ownServices(result: ReturnType<typeof computeAssignment>, studentId: string): string[] {
    return result.assignments.find(a => a.studentId === studentId)!.rotationServiceIds
}

// Score an assignment's services against the student's TRUE (honest)
// costs, regardless of which run (honest or min-maxed) produced that
// assignment — the only way to tell whether lying made the student
// genuinely better off, versus just changing the self-reported number.
function trueCostOf(honestGrades: Map<string, number>, services: string[]): number {
    return services.reduce((sum, id) => sum + (honestGrades.get(id) as number), 0)
}

function setsEqual(a: string[], b: string[]): boolean {
    const sa = new Set(a)
    const sb = new Set(b)
    return sa.size === sb.size && [...sa].every(x => sb.has(x))
}

// This is the evidence behind the "why honesty wins" claim on the
// how-it-works page (see HowItWorksPage.tsx, which quotes these exact
// numbers). If this test's assertions ever need to change, that page's
// copy is stale and must be reviewed alongside whatever changed here.
describe('gaming resistance: does exaggerating your votes pay off?', () => {
    it('shows one student min-maxing (bipolar 0/4) against otherwise-honest voters, scored against their true preferences', () => {
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
            const serviceCount = 4 + Math.floor(rng() * 4) // 4..7
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
                lotteryOrder
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
                lotteryOrder
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

            // The decisive question: scored against the student's TRUE
            // preferences, is the outcome they got BY LYING better than the
            // outcome they'd have gotten by being honest?
            const trueCostHonestRun = trueCostOf(honestGrades, honestServices)
            const trueCostMinMaxedRun = trueCostOf(honestGrades, minMaxedServices)
            const trueDelta = trueCostMinMaxedRun - trueCostHonestRun
            if (trueDelta < 0) genuinelyBetter++
            else if (trueDelta > 0) genuinelyWorse++
            else unchanged++

            if (minMaxedResult.worstCost > honestResult.worstCost) groupWorstIncreased++
        }

        // Pinned exactly where the outcome is structurally determined
        // (feasibility, and this specific victim's own true-cost delta
        // don't depend on how ties among equally-optimal solutions get
        // broken elsewhere in the group).
        expect(comparable).toBe(997)
        expect(genuinelyBetter).toBe(7)
        expect(groupWorstIncreased).toBe(94)

        // A handful of the 997 trials contain genuine ties elsewhere in the
        // group, so exactly which of them land on "worse" vs "unchanged" for
        // OTHER reasons can shift by a few counts under an unrelated, benign
        // change (e.g. service iteration order) without the underlying
        // optimum changing — pin a range, not an exact count, for those.
        expect(genuinelyWorse).toBeGreaterThanOrEqual(410)
        expect(genuinelyWorse).toBeLessThanOrEqual(435)
        expect(reallocated).toBeGreaterThanOrEqual(455)
        expect(reallocated).toBeLessThanOrEqual(480)
        expect(genuinelyBetter + genuinelyWorse + unchanged).toBe(comparable)

        // The headline claim, and the one thing that must never drift:
        // lying backfires far more often than it pays off — by a wide
        // margin, not a coin flip.
        expect(genuinelyWorse).toBeGreaterThan(genuinelyBetter * 10)

        // The headline claim: lying backfires far more often than it pays
        // off — by a wide margin, not a coin flip.
        expect(genuinelyWorse).toBeGreaterThan(genuinelyBetter * 10)
    })
})
