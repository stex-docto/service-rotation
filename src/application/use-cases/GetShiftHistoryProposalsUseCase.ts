import {
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    ShiftHistoryProposalEntity,
    ShiftHistoryProposalRepository
} from '@domain'

export interface GetShiftHistoryProposalsQuery {
    groupId: GroupId
}

export interface GetShiftHistoryProposalsResult {
    proposals: ShiftHistoryProposalEntity[]
}

// Every current member's proposal, pending or resolved — readable by any
// group member (see firestore.rules' shiftHistoryProposals/{uid}), so
// unlike ComputeResultUseCase this never requires the caller's own vote or
// proposal state to be anything in particular.
export class GetShiftHistoryProposalsUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly shiftHistoryProposalRepository: ShiftHistoryProposalRepository
    ) {}

    async execute(query: GetShiftHistoryProposalsQuery): Promise<GetShiftHistoryProposalsResult> {
        const group = await this.groupRepository.findById(query.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }

        const memberIds = group.getMembers().map(member => member.userId.value)
        const proposals = await this.shiftHistoryProposalRepository.findAll(
            query.groupId,
            memberIds
        )

        return { proposals }
    }
}
