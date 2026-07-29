import {
    Grade,
    GradeLevel,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    VoteEntity,
    VoteRepository
} from '@domain'
import { SignInUseCase } from '@application'

export interface SaveVoteDraftCommand {
    groupId: GroupId
    grades: Map<string, GradeLevel> // keyed by serviceId
}

export interface SaveVoteDraftResult {
    vote: VoteEntity
}

// Freely repeatable while unlocked — see VoteEntity.updateGrades and
// firestore.rules. There is no cap and no rejection concept any more: every
// service must be graded, and every grade is assignable.
export class SaveVoteDraftUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: SaveVoteDraftCommand): Promise<SaveVoteDraftResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (group.status !== 'open') {
            throw new Error('This group is not open for voting')
        }
        if (!group.isMember(user.id)) {
            throw new Error('You are not a member of this group')
        }

        // Every service must be graded — exactly once, nothing extra.
        const serviceIds = new Set(group.getServices().map(service => service.id.value))
        if (
            command.grades.size !== serviceIds.size ||
            [...serviceIds].some(id => !command.grades.has(id))
        ) {
            throw new Error('Every service must be graded exactly once')
        }

        const grades = new Map(
            Array.from(command.grades, ([serviceId, level]) => [serviceId, Grade.from(level)])
        )

        const existing = await this.voteRepository.findMine(command.groupId, user.id)
        const vote = existing
            ? existing.updateGrades(grades)
            : VoteEntity.createDraft(command.groupId, user.id, grades)

        await this.voteRepository.saveDraft(vote)

        return { vote }
    }
}
