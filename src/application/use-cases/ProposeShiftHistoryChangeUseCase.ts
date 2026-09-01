import {
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    ShiftHistoryProposalEntity,
    ShiftHistoryProposalRepository
} from '@domain'
import { MAX_MANUAL_SHIFT_HISTORY, SignInUseCase } from '@application'

export interface ProposeShiftHistoryChangeCommand {
    groupId: GroupId
    counts: Map<string, number>
    justification?: string | null
}

export interface ProposeShiftHistoryChangeResult {
    proposal: ShiftHistoryProposalEntity
}

// A member's correction request for their own row of Group.shiftHistory —
// the organizer stays the sole writer of the actual field (see README's
// honesty argument); this only opens a publicly visible request the
// creator accepts or rejects. Draft-only, like the history itself.
export class ProposeShiftHistoryChangeUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly shiftHistoryProposalRepository: ShiftHistoryProposalRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(
        command: ProposeShiftHistoryChangeCommand
    ): Promise<ProposeShiftHistoryChangeResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (group.status !== 'draft') {
            throw new Error('Shift history is frozen once voting opens')
        }
        if (!group.isMember(user.id)) {
            throw new Error('You are not a member of this group')
        }

        for (const count of command.counts.values()) {
            if (!Number.isInteger(count) || count < 0 || count > MAX_MANUAL_SHIFT_HISTORY) {
                throw new Error(
                    `Shift count must be a whole number between 0 and ${MAX_MANUAL_SHIFT_HISTORY}`
                )
            }
        }

        const proposal = ShiftHistoryProposalEntity.create(
            command.groupId,
            user.id,
            command.counts,
            command.justification ?? null
        )
        await this.shiftHistoryProposalRepository.save(proposal)

        return { proposal }
    }
}
