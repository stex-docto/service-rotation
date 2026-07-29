import {
    Email,
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError
} from '@domain'
import { SignInUseCase } from '@application'

export interface RemoveRosterEntryCommand {
    groupId: GroupId
    email: string
}

export interface RemoveRosterEntryResult {
    group: GroupEntity
}

export class RemoveRosterEntryUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: RemoveRosterEntryCommand): Promise<RemoveRosterEntryResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can edit the roster')
        }

        const updatedGroup = group.removeRosterEntry(Email.from(command.email))

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
