import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    VoteRepository
} from '@domain'
import { SignInUseCase } from '@application'

export interface FinishGroupCommand {
    groupId: GroupId
}

export interface FinishGroupResult {
    group: GroupEntity
}

// Creator-only, and only once every current member's vote is locked — the
// all-locked check is cross-aggregate (votes/voteStatus, not the group
// document itself) so it lives here rather than in Group.finish. Firestore
// rules can't verify this server-side (no loops, no per-doc get() budget for
// an arbitrary member count), so this is the one place that actually
// enforces it — see firestore.rules clause (h) for the write-side guard this
// still needs regardless. There's no Cloud Function to fire this
// automatically the moment the last vote locks: the creator's own client has
// to call it, which in practice means the transition only happens once the
// creator next opens the group (see OpenView's effect).
export class FinishGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: FinishGroupCommand): Promise<FinishGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can finish the group')
        }

        const memberIds = group.getMembers().map(member => member.userId.value)
        const statuses = await this.voteRepository.findStatuses(command.groupId, memberIds)
        const allLocked =
            memberIds.length > 0 &&
            statuses.length === memberIds.length &&
            statuses.every(status => status.locked)
        if (!allLocked) {
            throw new Error('Cannot finish the group: not every member has locked their vote')
        }

        const updatedGroup = group.finish()

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
