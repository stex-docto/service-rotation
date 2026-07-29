import { GroupEntity, GroupRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface CreateGroupCommand {
    name: string
    rotations: number
}

export interface CreateGroupResult {
    group: GroupEntity
}

export class CreateGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: CreateGroupCommand): Promise<CreateGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = GroupEntity.create(command.name, command.rotations, user.id, user.email)

        await this.groupRepository.save(group)

        return { group }
    }
}
