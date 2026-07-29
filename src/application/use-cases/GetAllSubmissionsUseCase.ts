import { GroupId, SubmissionEntity, SubmissionRepository } from '@domain'

export interface GetAllSubmissionsQuery {
    groupId: GroupId
}

export interface GetAllSubmissionsResult {
    submissions: SubmissionEntity[]
}

// Only resolves grades this caller is permitted to read — see
// SubmissionRepository.findAllByGroup and firestore.rules. Used for the
// post-compute transparency view: fairness through visibility, once the
// group is complete, into what everyone actually submitted.
export class GetAllSubmissionsUseCase {
    constructor(private readonly submissionRepository: SubmissionRepository) {}

    async execute(query: GetAllSubmissionsQuery): Promise<GetAllSubmissionsResult> {
        const submissions = await this.submissionRepository.findAllByGroup(query.groupId)
        return { submissions }
    }
}
