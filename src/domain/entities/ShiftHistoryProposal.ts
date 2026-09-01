import { GroupId, UserId } from '@domain'

export type ShiftHistoryProposalStatus = 'pending' | 'accepted' | 'rejected'

// A member's proposed correction to their own row of Group.shiftHistory —
// the organizer stays the sole writer of the actual history (see README's
// honesty argument), but a member who spots a wrong number needs a way to
// flag it that doesn't just become an unverifiable claim of its own. One
// doc per member, draft-only, readable by every group member so the
// resolution (accepted or rejected) is as public as the number it's about.
export interface ShiftHistoryProposal {
    groupId: GroupId
    userId: UserId
    counts: Map<string, number>
    justification: string | null
    status: ShiftHistoryProposalStatus
}

export class ShiftHistoryProposalEntity implements ShiftHistoryProposal {
    constructor(
        public readonly groupId: GroupId,
        public readonly userId: UserId,
        public readonly counts: Map<string, number>,
        public readonly justification: string | null,
        public readonly status: ShiftHistoryProposalStatus
    ) {}

    static create(
        groupId: GroupId,
        userId: UserId,
        counts: Map<string, number>,
        justification: string | null
    ): ShiftHistoryProposalEntity {
        return new ShiftHistoryProposalEntity(
            groupId,
            userId,
            new Map(counts),
            justification,
            'pending'
        )
    }

    // One-way, like VoteEntity.lock — a resolved proposal isn't relitigated;
    // the member can always open a fresh one afterward if they still
    // disagree, and that new one is just as visible as the first.
    resolve(status: 'accepted' | 'rejected'): ShiftHistoryProposalEntity {
        if (this.status !== 'pending') {
            throw new Error('This proposal has already been resolved')
        }
        return new ShiftHistoryProposalEntity(
            this.groupId,
            this.userId,
            this.counts,
            this.justification,
            status
        )
    }
}
