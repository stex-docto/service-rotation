import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    UserId
} from '@domain'
import { SignInUseCase } from '@application'

export interface BanMemberCommand {
    groupId: GroupId
    userId: UserId
}

export interface BanMemberResult {
    group: GroupEntity
}

// Creator-only forced removal, unlike LeaveGroupUseCase not gated on the
// target's own vote lock — this is a moderation override, not a self-service
// action the target could use to dodge an assignment they've already seen.
// Unlike a self-leave, this also records the uid as banned (see Group.ban)
// so they can't simply rejoin — see UnbanMemberUseCase for undoing that.
// Any vote/voteStatus documents left behind are harmless: every reader
// (ComputeResultUseCase, GetVotingProgressUseCase) filters by the group's
// current member list, so an orphaned vote for someone no longer a member is
// simply never looked at again.
export class BanMemberUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: BanMemberCommand): Promise<BanMemberResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can remove a member')
        }

        const updatedGroup = await this.groupRepository.ban(command.groupId, command.userId)

        return { group: updatedGroup }
    }
}
