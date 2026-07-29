import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface CloseInviteCommand {
    groupId: GroupId
}

export interface CloseInviteResult {
    group: GroupEntity
}

// The creator's one narrow privilege: stop the invite link from accepting
// new members, so "everyone who's in has voted" becomes a stable fact — see
// Group.closeInvite. It has no effect on anyone's ability to vote or read
// votes; it only stops the roster from growing further.
export class CloseInviteUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: CloseInviteCommand): Promise<CloseInviteResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can close the invite')
        }

        const updatedGroup = group.closeInvite()

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
