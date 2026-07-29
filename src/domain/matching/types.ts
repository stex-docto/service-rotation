// Pure types for the matching engine. Deliberately decoupled from the rest of
// the domain (plain string ids, numeric costs) so this module stays free of
// Firebase/React imports and is trivial to unit test in isolation — see the
// plan at the root of this repo. Translating GroupEntity/VoteEntity to and
// from these types is the job of the application layer.

// The engine derives its acceptable cost range from whatever the input
// actually contains (see costBoundsFor in assign.ts) rather than assuming a
// fixed scale — the application layer currently always populates costs from
// Grade's 0 (best) .. 3 (worst) scale, but that's the caller's convention,
// not a constraint enforced here. Every grade is assignable, there is no
// hard exclusion. A missing entry in a student's costs map is still treated
// as excluded by the graph builder (no edge is added), which the current
// application layer never relies on since every pair always has a grade —
// kept only because it's simpler than asserting completeness here.

export interface ServiceCapacity {
    serviceId: string
    // Capacity per rotation. The same room, reused rotation after rotation.
    capacityPerRotation: number
}

export interface StudentGrades {
    studentId: string
    // serviceId -> cost. Every service is expected to have an entry. The
    // application layer always uses Grade's 0..3 scale; the engine itself
    // doesn't require it — see the module comment above.
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
