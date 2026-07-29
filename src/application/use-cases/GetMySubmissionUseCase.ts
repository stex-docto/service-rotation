import { GroupId, SubmissionEntity, SubmissionRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface GetMySubmissionQuery {
    groupId: GroupId
}

export interface GetMySubmissionResult {
    submission: SubmissionEntity | null
}

export class GetMySubmissionUseCase {
    constructor(
        private readonly submissionRepository: SubmissionRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(query: GetMySubmissionQuery): Promise<GetMySubmissionResult> {
        const user = await this.signInUseCase.requireCurrentUser()
        const submission = await this.submissionRepository.findByGroupAndEmail(
            query.groupId,
            user.email
        )
        return { submission }
    }
}
