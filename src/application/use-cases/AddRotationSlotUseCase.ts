import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface AddRotationSlotCommand {
    groupId: GroupId
}

export interface AddRotationSlotResult {
    group: GroupEntity
}

export class AddRotationSlotUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: AddRotationSlotCommand): Promise<AddRotationSlotResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can add rotations')
        }

        const updatedGroup = group.addRotationSlot()

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
