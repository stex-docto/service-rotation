import { GroupId, VoteEntity, VoteRepository } from '@domain'
import { SignInUseCase } from '@application'

export interface LockVoteCommand {
    groupId: GroupId
}

export interface LockVoteResult {
    vote: VoteEntity
}

// One-way — see VoteEntity.lock and firestore.rules. Once locked, this
// member can read any other member's already-locked vote (and vice versa),
// but can no longer edit their own.
export class LockVoteUseCase {
    constructor(
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: LockVoteCommand): Promise<LockVoteResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const draft = await this.voteRepository.findMine(command.groupId, user.id)
        if (!draft) {
            throw new Error('Save your grades before locking your vote')
        }
        if (draft.locked) {
            throw new Error('Your vote is already locked')
        }

        const vote = await this.voteRepository.lock(command.groupId, user.id)

        return { vote }
    }
}
