import { GroupId, UserPreferencesRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface SetGroupHiddenCommand {
    groupId: GroupId
    hidden: boolean
}

// Purely a personal "my groups" display preference — never touches
// membership, votes, or anything anyone else can see. Exists because
// membership itself is permanent once a member has locked a vote (see
// LeaveGroupUseCase), so hiding is the only way to declutter afterward.
export class SetGroupHiddenUseCase {
    constructor(
        private readonly userPreferencesRepository: UserPreferencesRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: SetGroupHiddenCommand): Promise<void> {
        const user = await this.signInUseCase.requireCurrentUser()

        const hiddenGroupIds = await this.userPreferencesRepository.getHiddenGroupIds(user.id)
        const hidden = new Set(hiddenGroupIds)

        if (command.hidden) {
            hidden.add(command.groupId.value)
        } else {
            hidden.delete(command.groupId.value)
        }

        await this.userPreferencesRepository.setHiddenGroupIds(user.id, [...hidden])
    }
}
