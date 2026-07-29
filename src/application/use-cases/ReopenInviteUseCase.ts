import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface ReopenInviteCommand {
    groupId: GroupId
}

export interface ReopenInviteResult {
    group: GroupEntity
}

export class ReopenInviteUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: ReopenInviteCommand): Promise<ReopenInviteResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can reopen the invite')
        }

        const updatedGroup = group.reopenInvite()

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
