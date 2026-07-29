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
    // When false (the default), each student's rotationServiceIds are all
    // distinct — the classic "k different services" contract, enforced
    // regardless of services.length. When true AND services.length <
    // rotations, a student may be assigned the same service more than once —
    // the only way to still fill every rotation — with no cap beyond
    // `rotations` itself: min-cost flow decides the split purely on grades
    // (see buildNetwork's perStudentServiceCap). Whenever
    // services.length >= rotations this has no effect either way.
    allowRepeatedServices: boolean
}

export interface StudentAssignment {
    studentId: string
    // Index r is the service for rotation r. Always `rotations` entries;
    // distinct unless allowRepeatedServices was set on the input.
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
