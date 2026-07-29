import { GroupId, GroupNotFoundError, GroupRepository, VoteRepository, VoteStatus } from '@domain'

export interface GetVotingProgressQuery {
    groupId: GroupId
}

export interface GetVotingProgressResult {
    statuses: VoteStatus[]
    totalMembers: number
}

// Always available to any member, regardless of their own lock state — see
// VoteRepository.findStatuses and firestore.rules' voteStatus/{uid}, which
// is deliberately public within the group (locked: boolean only, never grade
// content). Unlike ComputeResultUseCase, this never requires the caller's
// own vote to be locked.
export class GetVotingProgressUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository
    ) {}

    async execute(query: GetVotingProgressQuery): Promise<GetVotingProgressResult> {
        const group = await this.groupRepository.findById(query.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }

        const memberIds = group.getMembers().map(member => member.userId.value)
        const statuses = await this.voteRepository.findStatuses(query.groupId, memberIds)

        return { statuses, totalMembers: memberIds.length }
    }
}
