import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    ServiceEntity
} from '@domain'
import { SignInUseCase } from '@application'

export interface AddServiceCommand {
    groupId: GroupId
    name: string
    description: string
    capacity: number
}

export interface AddServiceResult {
    group: GroupEntity
}

export class AddServiceUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: AddServiceCommand): Promise<AddServiceResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can add services')
        }

        const service = ServiceEntity.create(command.name, command.description, command.capacity)
        const updatedGroup = group.addService(service)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
