import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, VoteRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface LeaveGroupCommand {
    groupId: GroupId
}

export interface LeaveGroupResult {
    group: GroupEntity
}

export class LeaveGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: LeaveGroupCommand): Promise<LeaveGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }

        // Once locked, membership is permanent — leaving would let someone
        // dodge an assignment after seeing it, or shrink the roster capacity
        // math is planned against. See CLAUDE.md.
        const myVote = await this.voteRepository.findMine(command.groupId, user.id)
        if (myVote?.locked) {
            throw new Error('You can no longer leave once your vote is locked')
        }

        const updatedGroup = await this.groupRepository.leave(command.groupId, user.id)

        return { group: updatedGroup }
    }
}
