import { GroupId, VoteEntity, VoteRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface GetMyVoteQuery {
    groupId: GroupId
}

export interface GetMyVoteResult {
    vote: VoteEntity | null
}

export class GetMyVoteUseCase {
    constructor(
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(query: GetMyVoteQuery): Promise<GetMyVoteResult> {
        const user = await this.signInUseCase.requireCurrentUser()
        const vote = await this.voteRepository.findMine(query.groupId, user.id)
        return { vote }
    }
}
