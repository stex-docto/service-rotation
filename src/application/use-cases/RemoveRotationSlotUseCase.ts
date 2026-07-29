import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface RemoveRotationSlotCommand {
    groupId: GroupId
    index: number
}

export interface RemoveRotationSlotResult {
    group: GroupEntity
}

export class RemoveRotationSlotUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: RemoveRotationSlotCommand): Promise<RemoveRotationSlotResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can remove rotations')
        }

        const updatedGroup = group.removeRotationSlot(command.index)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
