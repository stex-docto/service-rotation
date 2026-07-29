import { GradeLevel, GroupId, ServiceId, UserId } from '@domain'

export interface Assignment {
    userId: UserId
    // Index i is the service for rotation i. Always `rotations` distinct services.
    rotationServiceIds: ServiceId[]
}

// A live, local computation — never persisted or shared as a canonical
// document (see README's security model). Two callers computing at
// different moments may legitimately get different Results if membership or
// votes changed in between; includedUserIds is what lets the caller tell a
// stable, everyone-included computation from a provisional one.
export interface Result {
    groupId: GroupId
    assignments: Assignment[]
    worstGradeLevel: GradeLevel
    totalCost: number
    // The unconstrained min-cost total, shown next to totalCost so the price
    // of the fairness (minimax) constraint is visible rather than hidden.
    theoreticalMinTotalCost: number
    seed: string
    computedAt: Date
    // Exactly who was readable and included in this run. May be a strict
    // subset of the group's current members — see ComputeResultUseCase.
    includedUserIds: string[]
}

export class ResultEntity implements Result {
    constructor(
        public readonly groupId: GroupId,
        public readonly assignments: Assignment[],
        public readonly worstGradeLevel: GradeLevel,
        public readonly totalCost: number,
        public readonly theoreticalMinTotalCost: number,
        public readonly seed: string,
        public readonly computedAt: Date,
        public readonly includedUserIds: string[]
    ) {}

    static create(
        groupId: GroupId,
        assignments: Assignment[],
        worstGradeLevel: GradeLevel,
        totalCost: number,
        theoreticalMinTotalCost: number,
        seed: string,
        includedUserIds: string[]
    ): ResultEntity {
        return new ResultEntity(
            groupId,
            assignments,
            worstGradeLevel,
            totalCost,
            theoreticalMinTotalCost,
            seed,
            new Date(),
            includedUserIds
        )
    }

    assignmentFor(userId: UserId): Assignment | undefined {
        return this.assignments.find(assignment => assignment.userId.equals(userId))
    }
}
