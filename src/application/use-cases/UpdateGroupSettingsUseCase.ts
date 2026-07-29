import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    RotationPeriod
} from '@domain'
import { SignInUseCase } from '@application'

export interface UpdateGroupSettingsCommand {
    groupId: GroupId
    name?: string
    rotations?: number
    rotationPeriods?: RotationPeriod[]
    maxRejections?: number
}

export interface UpdateGroupSettingsResult {
    group: GroupEntity
}

export class UpdateGroupSettingsUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: UpdateGroupSettingsCommand): Promise<UpdateGroupSettingsResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can change its settings')
        }

        const updatedGroup = group.updateSettings({
            name: command.name,
            rotations: command.rotations,
            rotationPeriods: command.rotationPeriods,
            maxRejections: command.maxRejections
        })

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
