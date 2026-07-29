import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    ServiceId
} from '@domain'
import { SignInUseCase } from '@application'

export interface UpdateServiceCommand {
    groupId: GroupId
    serviceId: ServiceId
    name?: string
    description?: string
    capacity?: number
}

export interface UpdateServiceResult {
    group: GroupEntity
}

export class UpdateServiceUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: UpdateServiceCommand): Promise<UpdateServiceResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can update services')
        }

        const currentService = group.services.find(command.serviceId)
        if (!currentService) {
            throw new Error('Service not found')
        }
        const updatedService = currentService.update(
            command.name,
            command.description,
            command.capacity
        )
        const updatedGroup = group.updateService(updatedService)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
