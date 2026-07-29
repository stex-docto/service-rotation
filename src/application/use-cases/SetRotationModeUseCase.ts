import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    RotationMode
} from '@domain'
import { SignInUseCase } from '@application'

export interface SetRotationModeCommand {
    groupId: GroupId
    mode: RotationMode
}

export interface SetRotationModeResult {
    group: GroupEntity
}

export class SetRotationModeUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: SetRotationModeCommand): Promise<SetRotationModeResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can change the rotation mode')
        }

        const updatedGroup = group.setRotationMode(command.mode)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
