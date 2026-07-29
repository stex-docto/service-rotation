// Pure types for the matching engine. Deliberately decoupled from the rest of
// the domain (plain string ids, numeric costs) so this module stays free of
// Firebase/React imports and is trivial to unit test in isolation — see the
// plan at the root of this repo. Translating GroupEntity/SubmissionEntity to
// and from these types is the job of the application layer.

// Acceptable grade costs are 0 (best) .. 4 (worst still assignable). A missing
// entry in a student's costs map means "rejected": the matching engine must
// never assign that student to that service, no matter how empty it is.
export const MIN_ACCEPTABLE_COST = 0
export const MAX_ACCEPTABLE_COST = 4

export interface ServiceCapacity {
    serviceId: string
    // Capacity per rotation. The same room, reused rotation after rotation.
    capacityPerRotation: number
}

export interface StudentGrades {
    studentId: string
    // serviceId -> cost (0..4). Absent key = rejected (hard exclude, not a cost).
    costs: Map<string, number>
}

export interface MatchingInput {
    rotations: number
    services: ServiceCapacity[]
    students: StudentGrades[]
    // Every student id, ranked by the pre-committed lottery (index 0 = first
    // rank). This is the sole source of tie-break determinism — see assign.ts.
    lotteryOrder: string[]
}

export interface StudentAssignment {
    studentId: string
    // Index r is the service for rotation r. Always `rotations` distinct ids.
    rotationServiceIds: string[]
}

export interface MatchingResult {
    assignments: StudentAssignment[]
    // The minimax threshold actually achieved: the worst grade cost anyone
    // received, minimised first, before the total is minimised.
    worstCost: number
    totalCost: number
    // The unconstrained min-cost total (no minimax cap), for comparison — the
    // visible price of the fairness constraint. Always <= totalCost.
    theoreticalMinTotalCost: number
}

export class InfeasibleError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InfeasibleError'
    }
}
