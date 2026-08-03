import { GroupEntity, GroupRepository, MemberEntry } from '@domain'
import { SignInUseCase } from '@application'

export interface CreateGroupCommand {
    name: string
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

        const group = GroupEntity.create(command.name, user.id)

        // firestore.rules' `create` requires an empty roster, so the creator
        // joins as a second write right away — same self-join path anyone
        // else uses, meaning they can leave later if they don't want to vote.
        await this.groupRepository.save(group)
        const entry = MemberEntry.create(user.id.value, user.displayName)
        const joinedGroup = await this.groupRepository.join(group.id, entry)

        return { group: joinedGroup }
    }
}
