import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    RosterEntry
} from '@domain'
import { SignInUseCase } from '@application'

export interface AddRosterEntryCommand {
    groupId: GroupId
    email: string
    displayName: string
}

export interface AddRosterEntryResult {
    group: GroupEntity
}

export class AddRosterEntryUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: AddRosterEntryCommand): Promise<AddRosterEntryResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can edit the roster')
        }

        const entry = RosterEntry.create(command.email, command.displayName)
        const updatedGroup = group.addRosterEntry(entry)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
