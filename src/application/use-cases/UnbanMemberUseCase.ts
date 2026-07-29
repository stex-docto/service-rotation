import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    UserId
} from '@domain'
import { SignInUseCase } from '@application'

export interface UnbanMemberCommand {
    groupId: GroupId
    userId: UserId
}

export interface UnbanMemberResult {
    group: GroupEntity
}

// Undoes a misclick, not a way to relitigate a moderation decision after the
// fact — only available while the roster itself isn't locked (see
// Group.unban). bannedMembers/bannedUids are creator-exclusive-write fields
// (see firestore.rules), so unlike BanMemberUseCase this can safely use
// save() rather than a transaction: nobody else can be racing this write.
export class UnbanMemberUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: UnbanMemberCommand): Promise<UnbanMemberResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can unban a member')
        }

        const updatedGroup = group.unban(command.userId)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
