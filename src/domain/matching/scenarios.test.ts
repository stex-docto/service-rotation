import { describe, expect, it } from 'vitest'
import { computeAssignment } from './assign'
import { bruteForceOptimal } from './bruteForceOracle'
import { scenarios } from './scenarios.fixtures'

describe.each(scenarios)('scenario: $name', ({ description, input, expected }) => {
    it(description, () => {
        const result = computeAssignment(input)

        expect(result.worstCost).toBe(expected.worstCost)
        expect(result.totalCost).toBe(expected.totalCost)
        expect(result.theoreticalMinTotalCost).toBe(expected.theoreticalMinTotalCost)

        // Structural invariants, independent of the pinned values above:
        // every student gets `rotations` distinct services, and no
        // service's per-rotation capacity is exceeded.
        for (const assignment of result.assignments) {
            expect(assignment.rotationServiceIds).toHaveLength(input.rotations)
            expect(new Set(assignment.rotationServiceIds).size).toBe(input.rotations)
        }
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

        // The set of services each student ends up with — order-independent,
        // since which rotation slot a service lands in is scheduleRotations'
        // internal choice, not part of the domain spec.
        const servicesByStudent = new Map(
            result.assignments.map(a => [a.studentId, a.rotationServiceIds])
        )
        for (const [studentId, expectedServices] of Object.entries(expected.servicesByStudent)) {
            const actual = servicesByStudent.get(studentId) as string[]
            expect(new Set(actual)).toEqual(new Set(expectedServices))
        }

        // Exact rotation-by-rotation schedule, only pinned where the fixture
        // deliberately locks scheduleRotations' behaviour too.
        if (expected.exactRotationScheduleByStudent) {
            for (const [studentId, exact] of Object.entries(
                expected.exactRotationScheduleByStudent
            )) {
                expect(servicesByStudent.get(studentId)).toEqual(exact)
            }
        }

        // Independently re-verify optimality for single-rotation scenarios,
        // where the brute-force oracle is tractable.
        if (input.rotations === 1) {
            const oracle = bruteForceOptimal(input)
            expect(result.worstCost).toBe(oracle.worst)
            expect(result.totalCost).toBe(oracle.total)
        }
    })
})
