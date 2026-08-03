import { GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface DeleteGroupCommand {
    groupId: GroupId
}

// Draft-only, and only while nobody but the creator has committed to the
// group yet — mirrors firestore.rules' delete clause exactly. The creator
// themselves is always a member from creation (see CreateGroupUseCase), so
// "nobody else has joined" is the real bar here, not "no members at all".
export class DeleteGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: DeleteGroupCommand): Promise<void> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can delete this group')
        }
        if (group.status !== 'draft') {
            throw new Error('Only a draft group can be deleted')
        }
        const otherMembers = group.getMembers().filter(member => !member.userId.equals(user.id))
        if (otherMembers.length > 0) {
            throw new Error('Cannot delete a group other members have already joined')
        }

        await this.groupRepository.delete(command.groupId)
    }
}
