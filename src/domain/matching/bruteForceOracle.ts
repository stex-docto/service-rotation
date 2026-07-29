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

// Exhaustive reference oracle for verifying computeAssignment's minimax
// optimality across multiple rotations, including repeats when
// allowRepeatedServices is set — unlike bruteForceOptimal above, this
// accounts for per-rotation capacity and rotation-by-rotation scheduling, so
// it's valid for any rotations count. Combinatorial explosion is roughly
// (services^rotations)^students, so only ever run on tiny instances (a
// couple of students/services/rotations).
export function bruteForceOptimalMultiRotation(input: MatchingInput): {
    worst: number
    total: number
} {
    const gradesByStudent = new Map(input.students.map(s => [s.studentId, s.costs]))
    // remainingCapacity[rotation].get(serviceId) = seats left in that round —
    // capacityPerRotation is reused every rotation, unlike the single-round
    // oracle's one shared pool above.
    const remainingCapacity: Map<string, number>[] = Array.from(
        { length: input.rotations },
        () => new Map(input.services.map(s => [s.serviceId, s.capacityPerRotation]))
    )
    let best: { worst: number; total: number } | null = null
    // Every individual (student, rotation) visit's cost, flat across
    // everyone — NOT summed per student first. "worst" is the worst single
    // visit anyone experiences (see README: "the worst grade cost anyone
    // received"), not the worst per-student total — those only coincide when
    // rotations === 1, which is all bruteForceOptimal above ever needs to
    // handle.
    const allVisitCosts: number[] = []

    function consider(): void {
        const worst = Math.max(...allVisitCosts)
        const total = allVisitCosts.reduce((sum, cost) => sum + cost, 0)
        if (!best || worst < best.worst || (worst === best.worst && total < best.total)) {
            best = { worst, total }
        }
    }

    function backtrackStudent(studentIndex: number): void {
        if (studentIndex === input.lotteryOrder.length) {
            consider()
            return
        }
        const studentId = input.lotteryOrder[studentIndex]
        const grades = gradesByStudent.get(studentId) as Map<string, number>

        function backtrackRotation(rotation: number, usedServices: Set<string>): void {
            if (rotation === input.rotations) {
                backtrackStudent(studentIndex + 1)
                return
            }
            for (const service of input.services) {
                if (!input.allowRepeatedServices && usedServices.has(service.serviceId)) continue
                const capacity = remainingCapacity[rotation].get(service.serviceId) as number
                if (capacity <= 0) continue
                const cost = grades.get(service.serviceId)
                if (cost === undefined) continue

                remainingCapacity[rotation].set(service.serviceId, capacity - 1)
                if (!input.allowRepeatedServices) usedServices.add(service.serviceId)
                allVisitCosts.push(cost)

                backtrackRotation(rotation + 1, usedServices)

                allVisitCosts.pop()
                if (!input.allowRepeatedServices) usedServices.delete(service.serviceId)
                remainingCapacity[rotation].set(service.serviceId, capacity)
            }
        }

        backtrackRotation(0, new Set())
    }

    backtrackStudent(0)
    if (!best) {
        throw new Error(
            'brute-force multi-rotation oracle found no feasible assignment — instance is unsound'
        )
    }
    return best
}
