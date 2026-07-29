import { MatchingInput } from './types'

// Exhaustive reference oracle for verifying computeAssignment's minimax
// optimality — O(services^students), so only ever run it on small instances.
// Only meaningful for rotations === 1 (a single service per student, no
// rotation scheduling to account for). Shared by assign.test.ts's property
// test and scenarios.test.ts's fixtures so the two never drift apart.
export function bruteForceOptimal(input: MatchingInput): { worst: number; total: number } {
    const remainingCapacity = new Map(input.services.map(s => [s.serviceId, s.capacityPerRotation]))
    const gradesByStudent = new Map(input.students.map(s => [s.studentId, s.costs]))
    let best: { worst: number; total: number } | null = null

    function consider(costs: number[]): void {
        const worst = Math.max(...costs)
        const total = costs.reduce((sum, cost) => sum + cost, 0)
        if (!best || worst < best.worst || (worst === best.worst && total < best.total)) {
            best = { worst, total }
        }
    }

    function backtrack(index: number, costsSoFar: number[]): void {
        if (index === input.lotteryOrder.length) {
            consider(costsSoFar)
            return
        }
        const studentId = input.lotteryOrder[index]
        const grades = gradesByStudent.get(studentId) as Map<string, number>
        for (const service of input.services) {
            const capacity = remainingCapacity.get(service.serviceId) as number
            if (capacity <= 0) continue
            const cost = grades.get(service.serviceId)
            if (cost === undefined) continue
            remainingCapacity.set(service.serviceId, capacity - 1)
            backtrack(index + 1, [...costsSoFar, cost])
            remainingCapacity.set(service.serviceId, capacity)
        }
    }

    backtrack(0, [])
    if (!best) {
        throw new Error('brute-force oracle found no feasible assignment — instance is unsound')
    }
    return best
}
