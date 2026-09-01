import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { SignInUseCase } from '@application'

export interface UpdateGroupSettingsCommand {
    groupId: GroupId
    name?: string
    allowRepeatedServices?: boolean
    pastShiftsEnabled?: boolean
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
            allowRepeatedServices: command.allowRepeatedServices,
            pastShiftsEnabled: command.pastShiftsEnabled
        })

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
