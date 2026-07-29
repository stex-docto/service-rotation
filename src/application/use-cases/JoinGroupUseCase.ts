import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, MemberEntry } from '@domain'
import { SignInUseCase } from '@application'

export interface JoinGroupCommand {
    groupId: GroupId
    displayName: string
}

export interface JoinGroupResult {
    group: GroupEntity
}

// Self-service: the group's link is the only capability needed — see
// firestore.rules. No organizer approval, no email involved.
export class JoinGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: JoinGroupCommand): Promise<JoinGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (group.isMember(user.id)) {
            return { group }
        }

        const entry = MemberEntry.create(user.id.value, command.displayName || user.displayName)
        const updatedGroup = await this.groupRepository.join(command.groupId, entry)

        return { group: updatedGroup }
    }
}
