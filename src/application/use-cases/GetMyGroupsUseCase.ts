import { GroupEntity, GroupRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface GetMyGroupsResult {
    created: GroupEntity[]
    participating: GroupEntity[]
}

export class GetMyGroupsUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(): Promise<GetMyGroupsResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const [created, participating] = await Promise.all([
            this.groupRepository.findCreatedByCurrentUser(),
            this.groupRepository.findByParticipantEmail(user.email)
        ])

        return { created, participating }
    }
}
