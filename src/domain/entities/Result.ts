import { Email, GradeLevel, GroupId, ServiceId } from '@domain'

export interface Assignment {
    email: Email
    // Index i is the service for rotation i. Always `rotations` distinct services.
    rotationServiceIds: ServiceId[]
}

export interface Result {
    groupId: GroupId
    assignments: Assignment[]
    worstGradeLevel: GradeLevel
    totalCost: number
    // The unconstrained min-cost total, shown next to totalCost so the price of
    // the fairness (minimax) constraint is visible rather than hidden.
    theoreticalMinTotalCost: number
    seed: string
    computedAt: Date
}

export class ResultEntity implements Result {
    constructor(
        public readonly groupId: GroupId,
        public readonly assignments: Assignment[],
        public readonly worstGradeLevel: GradeLevel,
        public readonly totalCost: number,
        public readonly theoreticalMinTotalCost: number,
        public readonly seed: string,
        public readonly computedAt: Date
    ) {}

    static create(
        groupId: GroupId,
        assignments: Assignment[],
        worstGradeLevel: GradeLevel,
        totalCost: number,
        theoreticalMinTotalCost: number,
        seed: string
    ): ResultEntity {
        return new ResultEntity(
            groupId,
            assignments,
            worstGradeLevel,
            totalCost,
            theoreticalMinTotalCost,
            seed,
            new Date()
        )
    }

    assignmentFor(email: Email): Assignment | undefined {
        return this.assignments.find(assignment => assignment.email.equals(email))
    }
}
