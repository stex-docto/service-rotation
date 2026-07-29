import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    ServiceId
} from '@domain'
import { SignInUseCase } from '@application'

export interface RemoveServiceCommand {
    groupId: GroupId
    serviceId: ServiceId
}

export interface RemoveServiceResult {
    group: GroupEntity
}

export class RemoveServiceUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: RemoveServiceCommand): Promise<RemoveServiceResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can remove services')
        }

        const updatedGroup = group.removeService(command.serviceId)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
