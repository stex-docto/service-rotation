import { describe, expect, it } from 'vitest'
import { scheduleRotations } from './edgeColouring'
import type { ServiceCapacity } from './types'

describe('scheduleRotations (phase 2)', () => {
    it('schedules a fixed phase-1 assignment into distinct, capacity-respecting rotations', () => {
        const rotations = 2
        const services: ServiceCapacity[] = [
            { serviceId: 'A', capacityPerRotation: 1 },
            { serviceId: 'B', capacityPerRotation: 1 },
            { serviceId: 'C', capacityPerRotation: 3 } // generous — forces dummy padding
        ]
        const lotteryOrder = ['s0', 's1', 's2', 's3']
        // A and B are each exactly full (2 uses = rotations * capacity); C has
        // slack. Every student has exactly 2 distinct services.
        const phase1 = new Map<string, string[]>([
            ['s0', ['A', 'C']],
            ['s1', ['B', 'C']],
            ['s2', ['A', 'C']],
            ['s3', ['B', 'C']]
        ])

        const schedule = scheduleRotations(phase1, services, rotations, lotteryOrder)

        for (const studentId of lotteryOrder) {
            const assigned = schedule.get(studentId) as string[]
            expect(assigned).toHaveLength(rotations)
            expect(new Set(assigned)).toEqual(new Set(phase1.get(studentId)))
        }

        for (let rotation = 0; rotation < rotations; rotation++) {
            const countByService = new Map<string, number>()
            for (const studentId of lotteryOrder) {
                const serviceId = (schedule.get(studentId) as string[])[rotation]
                countByService.set(serviceId, (countByService.get(serviceId) ?? 0) + 1)
            }
            for (const service of services) {
                expect(countByService.get(service.serviceId) ?? 0).toBeLessThanOrEqual(
                    service.capacityPerRotation
                )
            }
        }
    })

    it('is deterministic given the same phase-1 assignment and lottery order', () => {
        const rotations = 3
        const services: ServiceCapacity[] = [
            { serviceId: 'A', capacityPerRotation: 2 },
            { serviceId: 'B', capacityPerRotation: 2 },
            { serviceId: 'C', capacityPerRotation: 2 }
        ]
        const lotteryOrder = ['s0', 's1', 's2', 's3']
        const phase1 = new Map<string, string[]>([
            ['s0', ['A', 'B', 'C']],
            ['s1', ['A', 'B', 'C']],
            ['s2', ['A', 'B', 'C']],
            ['s3', ['A', 'B', 'C']]
        ])

        const first = scheduleRotations(phase1, services, rotations, lotteryOrder)
        const second = scheduleRotations(phase1, services, rotations, lotteryOrder)

        expect(Array.from(second.entries())).toEqual(Array.from(first.entries()))
    })
})
