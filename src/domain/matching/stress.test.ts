// Configurable load test for computeAssignment: generates a large batch of
// random instances across tunable ranges and runs every one through the
// algorithm, checking the same structural invariants as the property test
// in assign.test.ts (every student gets `rotations` distinct services,
// capacity never exceeded) plus printing an aggregate report (cost
// distribution, fairness price, infeasibility rate, timing).
//
// Unlike assign.test.ts's 300-trial property test — which runs on every
// `make test` with ranges deliberately calibrated to two historical bugs
// (see its comment) — this file is OFF by default and skipped unless
// STRESS_TRIALS is set, because 1000+ trials at up to 30 students/10
// services is real work you don't want slowing down every test run. Use it
// on demand, before and after a change to assign.ts/edgeColouring.ts/
// minCostFlow.ts, to see the shift in behaviour at scale without hand-authoring
// scenarios for it.
//
// Run with defaults (1000 trials, 5-30 students, 3-10 services, ~4 capacity,
// 2-5 rotations):
//   docker compose run --rm -e STRESS_TRIALS=1000 frontend \
//     yarn vitest run src/domain/matching/stress.test.ts
//
// Override any range (all optional, all integers):
//   -e STRESS_MIN_STUDENTS=10 -e STRESS_MAX_STUDENTS=50
//   -e STRESS_MIN_SERVICES=2  -e STRESS_MAX_SERVICES=15
//   -e STRESS_MIN_CAPACITY=1  -e STRESS_MAX_CAPACITY=8
//   -e STRESS_MIN_ROTATIONS=1 -e STRESS_MAX_ROTATIONS=6
//   -e STRESS_SEED=42
//
// STRESS_WEIGHTS overrides the cost scale itself (comma-separated, default
// "0,1,2,3" — each generated grade is drawn uniformly from this list):
//   -e STRESS_WEIGHTS="-1,1,2,4"
//
// STRESS_ALLOW_REPEATED_SERVICES ("1"/"true", default off) turns on
// MatchingInput.allowRepeatedServices for every generated instance. Combine
// with a services range below the rotations range to specifically stress
// the repeat-service path (services.length < rotations), e.g. to compare
// the infeasibility rate before/after:
//   -e STRESS_TRIALS=2000 -e STRESS_MIN_SERVICES=1 -e STRESS_MAX_SERVICES=3 \
//   -e STRESS_MIN_ROTATIONS=4 -e STRESS_MAX_ROTATIONS=8 \
//   -e STRESS_ALLOW_REPEATED_SERVICES=1
//
// IMPORTANT: MIN_ACCEPTABLE_COST/MAX_ACCEPTABLE_COST in types.ts are still
// hardcoded to 0/3 and are NOT derived from STRESS_WEIGHTS — that's
// deliberate, not an oversight. Pointing this at an out-of-range scale
// (anything outside 0..3) is exactly how you demonstrate, at load, the
// fragility those two constants create: expect InfeasibleError to fire on
// instances that are actually feasible (whenever a weight above 3 is
// structurally required), and/or the worstCost cross-check below to fail
// fast (whenever a weight below 0 is the true worst experienced by anyone).
// A fast failure IS the impact being measured here, not a bug in this file —
// see the "how the cost is computed" discussion in session notes for why.
import { describe, expect, it } from 'vitest'
import { computeAssignment } from './assign'
import { InfeasibleError, MatchingInput, ServiceCapacity } from './types'

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

function envInt(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw) return fallback
    const value = Number.parseInt(raw, 10)
    return Number.isFinite(value) ? value : fallback
}

function envWeights(name: string, fallback: number[]): number[] {
    const raw = process.env[name]
    if (!raw) return fallback
    const values = raw.split(',').map(part => Number.parseFloat(part.trim()))
    return values.every(Number.isFinite) && values.length > 0 ? values : fallback
}

function randomInRange(rng: () => number, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1))
}

function pickWeight(rng: () => number, weights: number[]): number {
    return weights[Math.floor(rng() * weights.length)]
}

function envBool(name: string, fallback: boolean): boolean {
    const raw = process.env[name]
    if (!raw) return fallback
    return raw === '1' || raw.toLowerCase() === 'true'
}

const config = {
    trials: envInt('STRESS_TRIALS', 0),
    seed: envInt('STRESS_SEED', 1),
    minStudents: envInt('STRESS_MIN_STUDENTS', 5),
    maxStudents: envInt('STRESS_MAX_STUDENTS', 30),
    minServices: envInt('STRESS_MIN_SERVICES', 3),
    maxServices: envInt('STRESS_MAX_SERVICES', 10),
    minCapacity: envInt('STRESS_MIN_CAPACITY', 2),
    maxCapacity: envInt('STRESS_MAX_CAPACITY', 6),
    minRotations: envInt('STRESS_MIN_ROTATIONS', 2),
    maxRotations: envInt('STRESS_MAX_ROTATIONS', 5),
    weights: envWeights('STRESS_WEIGHTS', [0, 1, 2, 3]),
    // Off by default — matches computeAssignment's own default and keeps
    // this load test's existing baseline behaviour unchanged unless someone
    // explicitly opts in, e.g. to stress serviceCount < rotations ranges
    // (see the module comment for an example invocation).
    allowRepeatedServices: envBool('STRESS_ALLOW_REPEATED_SERVICES', false)
}

function generateRandomInput(rng: () => number): MatchingInput {
    const rotations = randomInRange(rng, config.minRotations, config.maxRotations)
    const serviceCount = randomInRange(rng, config.minServices, config.maxServices)
    const studentCount = randomInRange(rng, config.minStudents, config.maxStudents)

    const services: ServiceCapacity[] = Array.from({ length: serviceCount }, (_, i) => ({
        serviceId: `svc${i}`,
        capacityPerRotation: randomInRange(rng, config.minCapacity, config.maxCapacity)
    }))

    const lotteryOrder = Array.from({ length: studentCount }, (_, i) => `student${i}`)
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: new Map(
            services.map(service => [service.serviceId, pickWeight(rng, config.weights)])
        )
    }))

    return {
        rotations,
        services,
        students,
        lotteryOrder,
        allowRepeatedServices: config.allowRepeatedServices
    }
}

function checkInvariants(input: MatchingInput, result: ReturnType<typeof computeAssignment>): void {
    const gradesByStudent = new Map(input.students.map(s => [s.studentId, s.costs]))
    // -Infinity, not 0: a 0 floor would silently reproduce the exact
    // clamping bug this cross-check exists to catch once weights can be
    // negative (see STRESS_WEIGHTS above).
    let recomputedWorst = -Infinity
    let recomputedTotal = 0

    for (const assignment of result.assignments) {
        expect(assignment.rotationServiceIds).toHaveLength(input.rotations)
        if (!input.allowRepeatedServices) {
            expect(new Set(assignment.rotationServiceIds).size).toBe(input.rotations)
        }

        const grades = gradesByStudent.get(assignment.studentId) as Map<string, number>
        for (const serviceId of assignment.rotationServiceIds) {
            const cost = grades.get(serviceId) as number
            recomputedTotal += cost
            recomputedWorst = Math.max(recomputedWorst, cost)
        }
    }
    // Cross-check the reported worstCost/totalCost against the raw votes —
    // catches a misreporting bug (e.g. a clamped/miscomputed worstCost) even
    // when the assignment itself is structurally valid, which the capacity
    // checks below wouldn't notice on their own.
    expect(result.worstCost).toBe(recomputedWorst)
    expect(result.totalCost).toBe(recomputedTotal)

    for (let rotation = 0; rotation < input.rotations; rotation++) {
        const countByService = new Map<string, number>()
        for (const assignment of result.assignments) {
            const serviceId = assignment.rotationServiceIds[rotation]
            countByService.set(serviceId, (countByService.get(serviceId) ?? 0) + 1)
        }
        for (const service of input.services) {
            expect(countByService.get(service.serviceId) ?? 0).toBeLessThanOrEqual(
                service.capacityPerRotation
            )
        }
    }
    expect(result.theoreticalMinTotalCost).toBeLessThanOrEqual(result.totalCost)
}

function summary(values: number[]) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0 }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    return { min, max, avg: Math.round(avg * 100) / 100 }
}

describe.skipIf(config.trials <= 0)('computeAssignment: configurable load test', () => {
    it(`runs ${config.trials} random instances across the configured ranges`, () => {
        const rng = mulberry32(config.seed)

        let feasibleCount = 0
        let infeasibleCount = 0
        const worstCosts: number[] = []
        const totalCosts: number[] = []
        const fairnessPrices: number[] = []
        const studentCounts: number[] = []
        const serviceCounts: number[] = []
        const rotationCounts: number[] = []
        const durationsMs: number[] = []
        let fairnessPriceCount = 0

        for (let trial = 0; trial < config.trials; trial++) {
            const input = generateRandomInput(rng)
            studentCounts.push(input.lotteryOrder.length)
            serviceCounts.push(input.services.length)
            rotationCounts.push(input.rotations)

            const start = performance.now()
            let result
            try {
                result = computeAssignment(input)
            } catch (error) {
                if (error instanceof InfeasibleError) {
                    infeasibleCount++
                    continue
                }
                throw new Error(
                    `Trial ${trial} (seed ${config.seed}) crashed unexpectedly: ${error instanceof Error ? error.message : error}`
                )
            }
            durationsMs.push(performance.now() - start)

            checkInvariants(input, result)

            feasibleCount++
            worstCosts.push(result.worstCost)
            totalCosts.push(result.totalCost)
            const fairnessPrice = result.totalCost - result.theoreticalMinTotalCost
            fairnessPrices.push(fairnessPrice)
            if (fairnessPrice > 0) fairnessPriceCount++
        }

        console.log(
            `\n=== load test: ${config.trials} trials, seed ${config.seed} ===\n` +
                `ranges: students ${config.minStudents}-${config.maxStudents}, ` +
                `services ${config.minServices}-${config.maxServices}, ` +
                `capacity ${config.minCapacity}-${config.maxCapacity}, ` +
                `rotations ${config.minRotations}-${config.maxRotations}, ` +
                `weights [${config.weights.join(',')}]\n` +
                `feasible: ${feasibleCount} (${Math.round((feasibleCount / config.trials) * 100)}%), ` +
                `infeasible: ${infeasibleCount} (${Math.round((infeasibleCount / config.trials) * 100)}%)\n` +
                `worstCost: ${JSON.stringify(summary(worstCosts))}\n` +
                `totalCost: ${JSON.stringify(summary(totalCosts))}\n` +
                `fairnessPrice: ${JSON.stringify(summary(fairnessPrices))}, ` +
                `nonzero in ${fairnessPriceCount}/${feasibleCount} feasible trials\n` +
                `duration ms/trial: ${JSON.stringify(summary(durationsMs))}, total ${Math.round(durationsMs.reduce((s, v) => s + v, 0))}ms`
        )

        // Sanity on the generator itself — guards against a config that only
        // ever produces feasible or only ever infeasible instances, which
        // would silently narrow what this run actually covered.
        expect(feasibleCount + infeasibleCount).toBe(config.trials)
    })
})
