import { GroupEntity, GroupRepository, UserPreferencesRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface GetMyGroupsResult {
    created: GroupEntity[]
    participating: GroupEntity[]
    // Anything the caller has hidden (see SetGroupHiddenUseCase) — split out
    // rather than dropped, so the UI can still surface them (e.g. in a
    // folded section) instead of making them unreachable.
    hidden: GroupEntity[]
}

export class GetMyGroupsUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly userPreferencesRepository: UserPreferencesRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(): Promise<GetMyGroupsResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const [created, participating, hiddenGroupIds] = await Promise.all([
            this.groupRepository.findCreatedByCurrentUser(),
            this.groupRepository.findByMember(user.id),
            this.userPreferencesRepository.getHiddenGroupIds(user.id)
        ])

        const hiddenIds = new Set(hiddenGroupIds)
        const allByGroupId = new Map(
            [...created, ...participating].map(group => [group.id.value, group])
        )

        return {
            created: created.filter(group => !hiddenIds.has(group.id.value)),
            participating: participating.filter(group => !hiddenIds.has(group.id.value)),
            hidden: [...allByGroupId.values()].filter(group => hiddenIds.has(group.id.value))
        }
    }
}
