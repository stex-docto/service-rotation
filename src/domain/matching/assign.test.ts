import { describe, expect, it } from 'vitest'
import { checkStructuralFeasibility, computeAssignment } from './assign'
import { bruteForceOptimal } from './bruteForceOracle'
import { InfeasibleError, MatchingInput, ServiceCapacity } from './types'

// Deterministic PRNG (mulberry32) so property tests are reproducible across
// runs and CI machines — no reliance on Math.random's seed.
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

describe('computeAssignment: determinism', () => {
    it('produces byte-identical output across repeated runs on the same input', () => {
        const services: ServiceCapacity[] = [
            { serviceId: 'Cardiology', capacityPerRotation: 2 },
            { serviceId: 'Neurology', capacityPerRotation: 1 },
            { serviceId: 'Pediatrics', capacityPerRotation: 2 },
            { serviceId: 'Emergency', capacityPerRotation: 2 }
        ]
        const lotteryOrder = ['alice', 'bob', 'carol', 'dana', 'eve']
        const students = lotteryOrder.map((studentId, i) => ({
            studentId,
            costs: new Map(services.map((service, j) => [service.serviceId, (i + j) % 4]))
        }))
        const input: MatchingInput = { rotations: 2, services, students, lotteryOrder }

        const first = computeAssignment(input)
        const second = computeAssignment(input)

        expect(second).toEqual(first)
    })
})

describe('computeAssignment: invariants under random feasible instances', () => {
    it('gives every student `rotations` distinct services within capacity', () => {
        // Ranges mirror an ad-hoc 3000-trial stress script run during
        // development (not committed) that caught two real bugs a smaller,
        // "generous capacity" sweep missed entirely: a Set-based dummy-padding
        // step in scheduleRotations that silently dropped multi-edges, and an
        // unbounded tie-break constant. Both needed tight capacity (as low as
        // 1) and a wider student/service/rotation count to surface — see
        // edgeColouring.ts and assign.ts (tieBreakScaleFor) for the fixes.
        // Keep these ranges wide rather than narrowing back down for speed.
        let trialsRun = 0

        for (let trial = 0; trial < 300; trial++) {
            const rng = mulberry32(1000 + trial)
            const rotations = 1 + Math.floor(rng() * 6) // 1..6
            const serviceCount = Math.min(16, rotations + 1 + Math.floor(rng() * 10)) // always > rotations, up to 16
            const studentCount = 2 + Math.floor(rng() * 60) // 2..61

            const services: ServiceCapacity[] = Array.from({ length: serviceCount }, (_, i) => ({
                serviceId: `svc${i}`,
                capacityPerRotation: 1 + Math.floor(rng() * 20) // 1..20 — tight capacities matter, see above
            }))

            const lotteryOrder = Array.from({ length: studentCount }, (_, i) => `student${i}`)
            const students = lotteryOrder.map(studentId => ({
                studentId,
                costs: new Map(services.map(service => [service.serviceId, Math.floor(rng() * 4)]))
            }))

            const input: MatchingInput = { rotations, services, students, lotteryOrder }

            let result
            try {
                result = computeAssignment(input)
            } catch (error) {
                if (error instanceof InfeasibleError) continue // tight capacities make this common; skip defensively
                throw error
            }
            trialsRun++
            const gradesByStudent = new Map(students.map(s => [s.studentId, s.costs]))

            for (const assignment of result.assignments) {
                expect(assignment.rotationServiceIds).toHaveLength(rotations)
                expect(new Set(assignment.rotationServiceIds).size).toBe(rotations)

                const grades = gradesByStudent.get(assignment.studentId) as Map<string, number>
                for (const serviceId of assignment.rotationServiceIds) {
                    expect(grades.has(serviceId)).toBe(true)
                }
            }

            for (let rotation = 0; rotation < rotations; rotation++) {
                const countByService = new Map<string, number>()
                for (const assignment of result.assignments) {
                    const serviceId = assignment.rotationServiceIds[rotation]
                    countByService.set(serviceId, (countByService.get(serviceId) ?? 0) + 1)
                }
                for (const service of services) {
                    expect(countByService.get(service.serviceId) ?? 0).toBeLessThanOrEqual(
                        service.capacityPerRotation
                    )
                }
            }

            expect(result.theoreticalMinTotalCost).toBeLessThanOrEqual(result.totalCost)
        }

        // Guards against every trial being skipped by the feasibility check
        // above, which would let this test pass vacuously.
        expect(trialsRun).toBeGreaterThan(50)
    })
})

describe('computeAssignment: minimax optimality against a brute-force oracle', () => {
    it('achieves the true minimal worst-case grade and, among ties, the true minimal total', () => {
        let trialsRun = 0

        for (let trial = 0; trial < 30; trial++) {
            const rng = mulberry32(5000 + trial)
            const studentCount = 2 + Math.floor(rng() * 3) // 2..4
            const serviceCount = 2 + Math.floor(rng() * 2) // 2..3

            const services: ServiceCapacity[] = Array.from({ length: serviceCount }, (_, i) => ({
                serviceId: `svc${i}`,
                capacityPerRotation: 1 + Math.floor(rng() * 2)
            }))
            const totalCapacity = services.reduce((sum, s) => sum + s.capacityPerRotation, 0)
            if (totalCapacity < studentCount) continue

            const lotteryOrder = Array.from({ length: studentCount }, (_, i) => `student${i}`)
            const students = lotteryOrder.map(studentId => ({
                studentId,
                costs: new Map(services.map(service => [service.serviceId, Math.floor(rng() * 4)]))
            }))

            const input: MatchingInput = { rotations: 1, services, students, lotteryOrder }

            let result
            try {
                result = computeAssignment(input)
            } catch (error) {
                if (error instanceof InfeasibleError) continue
                throw error
            }
            const oracle = bruteForceOptimal(input)

            expect(result.worstCost).toBe(oracle.worst)
            expect(result.totalCost).toBe(oracle.total)
            trialsRun++
        }

        // Guards against every trial being skipped by the capacity check above,
        // which would make this test vacuously pass.
        expect(trialsRun).toBeGreaterThan(10)
    })
})

describe('computeAssignment: hand-verified golden case', () => {
    it('matches an exhaustively hand-checked 4-student, single-rotation instance', () => {
        // S1 cap1, S2 cap2, S3 cap1 — exactly 4 seats for 4 students, so every
        // seat is filled. Verified by hand across all 12 possible assignments:
        // the unique minimax optimum is Alice->S1, Dana->S3, Bob/Carol->S2,
        // giving worst=1, total=1 — which also happens to be the unconstrained
        // global minimum total for this particular instance.
        const services: ServiceCapacity[] = [
            { serviceId: 'S1', capacityPerRotation: 1 },
            { serviceId: 'S2', capacityPerRotation: 2 },
            { serviceId: 'S3', capacityPerRotation: 1 }
        ]
        const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana']
        const grades: Record<string, number[]> = {
            Alice: [0, 2, 3],
            Bob: [0, 1, 3],
            Carol: [1, 0, 2],
            Dana: [2, 1, 0]
        }
        const students = lotteryOrder.map(studentId => ({
            studentId,
            costs: new Map(services.map((service, i) => [service.serviceId, grades[studentId][i]]))
        }))

        const result = computeAssignment({ rotations: 1, services, students, lotteryOrder })

        expect(result.worstCost).toBe(1)
        expect(result.totalCost).toBe(1)
        expect(result.theoreticalMinTotalCost).toBe(1)

        const serviceOf = new Map(
            result.assignments.map(a => [a.studentId, a.rotationServiceIds[0]])
        )
        expect(serviceOf.get('Alice')).toBe('S1')
        expect(serviceOf.get('Dana')).toBe('S3')
        expect(serviceOf.get('Bob')).toBe('S2')
        expect(serviceOf.get('Carol')).toBe('S2')
    })
})

describe('checkStructuralFeasibility', () => {
    it('flags fewer services than rotations', () => {
        const services: ServiceCapacity[] = [
            { serviceId: 'S1', capacityPerRotation: 10 },
            { serviceId: 'S2', capacityPerRotation: 10 }
        ]

        const { feasible, reason } = checkStructuralFeasibility(services, 3)

        expect(feasible).toBe(false)
        expect(reason).toBeTruthy()
    })

    it('passes once there are at least as many services as rotations', () => {
        const services: ServiceCapacity[] = [
            { serviceId: 'S1', capacityPerRotation: 10 },
            { serviceId: 'S2', capacityPerRotation: 10 },
            { serviceId: 'S3', capacityPerRotation: 10 }
        ]

        const { feasible } = checkStructuralFeasibility(services, 3)

        expect(feasible).toBe(true)
    })
})

describe('computeAssignment: capacity infeasibility', () => {
    it('throws InfeasibleError for a genuinely infeasible instance that naive arithmetic would miss', () => {
        // 4 students, 3 rotations. services.length === rotations, so every
        // student must visit ALL THREE services — including S2, capacity 1
        // per rotation. That's only 3 person-visits available across 3
        // rotations, for 4 students who each need one. Both naive checks
        // (services >= rotations: 3>=3; total capacity >= student count:
        // 102>=4) pass; only the flow-based check catches the real shortfall.
        const services: ServiceCapacity[] = [
            { serviceId: 'S1', capacityPerRotation: 100 },
            { serviceId: 'S2', capacityPerRotation: 1 },
            { serviceId: 'S3', capacityPerRotation: 1 }
        ]
        const lotteryOrder = ['student-a', 'student-b', 'student-c', 'student-d']
        const students = lotteryOrder.map(studentId => ({
            studentId,
            costs: new Map(services.map(service => [service.serviceId, 0]))
        }))

        expect(() => computeAssignment({ rotations: 3, services, students, lotteryOrder })).toThrow(
            InfeasibleError
        )
    })

    it('confirms the same services are feasible with one fewer mandatory rotation', () => {
        // Same services and students, but 2 rotations means services > rotations
        // again, so students have a real choice and are not all forced
        // through the capacity-1 services.
        const services: ServiceCapacity[] = [
            { serviceId: 'S1', capacityPerRotation: 100 },
            { serviceId: 'S2', capacityPerRotation: 1 },
            { serviceId: 'S3', capacityPerRotation: 1 }
        ]
        const lotteryOrder = ['student-a', 'student-b', 'student-c', 'student-d']
        const students = lotteryOrder.map(studentId => ({
            studentId,
            costs: new Map(services.map(service => [service.serviceId, 0]))
        }))

        expect(() =>
            computeAssignment({ rotations: 2, services, students, lotteryOrder })
        ).not.toThrow()
    })
})
