import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    ShiftHistoryProposalEntity,
    ShiftHistoryProposalRepository,
    UserId
} from '@domain'
import { SignInUseCase } from '@application'

export interface ResolveShiftHistoryProposalCommand {
    groupId: GroupId
    userId: UserId
    decision: 'accepted' | 'rejected'
}

export interface ResolveShiftHistoryProposalResult {
    proposal: ShiftHistoryProposalEntity
    group: GroupEntity
}

// Accepting applies the proposed row to Group.shiftHistory via the same
// setMemberShiftHistory a manual edit uses; rejecting only marks the
// proposal resolved and leaves the history untouched. Either way the
// resolution stays visible — see ShiftHistoryProposalEntity.resolve.
export class ResolveShiftHistoryProposalUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly shiftHistoryProposalRepository: ShiftHistoryProposalRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(
        command: ResolveShiftHistoryProposalCommand
    ): Promise<ResolveShiftHistoryProposalResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can resolve a shift history proposal')
        }

        const proposal = await this.shiftHistoryProposalRepository.findFor(
            command.groupId,
            command.userId
        )
        if (!proposal) {
            throw new Error('No proposal found for this member')
        }

        const resolvedProposal = proposal.resolve(command.decision)
        await this.shiftHistoryProposalRepository.save(resolvedProposal)

        if (command.decision === 'rejected') {
            return { proposal: resolvedProposal, group }
        }

        const updatedGroup = group.setMemberShiftHistory(command.userId, proposal.counts)
        await this.groupRepository.save(updatedGroup)

        return { proposal: resolvedProposal, group: updatedGroup }
    }
}
