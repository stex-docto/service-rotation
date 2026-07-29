import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    RotationSlot
} from '@domain'
import { SignInUseCase } from '@application'

export interface UpdateRotationSlotCommand {
    groupId: GroupId
    index: number
    name?: string | null
    startDate?: string | null
    endDate?: string | null
}

export interface UpdateRotationSlotResult {
    group: GroupEntity
}

export class UpdateRotationSlotUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: UpdateRotationSlotCommand): Promise<UpdateRotationSlotResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can update rotations')
        }

        const changes: Partial<RotationSlot> = {}
        if (command.name !== undefined) changes.name = command.name
        if (command.startDate !== undefined) changes.startDate = command.startDate
        if (command.endDate !== undefined) changes.endDate = command.endDate

        const updatedGroup = group.updateRotationSlot(command.index, changes)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
