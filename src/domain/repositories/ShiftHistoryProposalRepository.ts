import { GroupId, ShiftHistoryProposalEntity, UserId } from '@domain'

export interface ShiftHistoryProposalRepository {
    // Create-or-overwrite. Rejected by firestore.rules once the target
    // proposal is no longer 'pending' — see ShiftHistoryProposalEntity.resolve.
    save(proposal: ShiftHistoryProposalEntity): Promise<void>

    // One member's own proposal, regardless of who's asking — the creator
    // uses this to look up a specific member's proposal when resolving it,
    // not only a caller looking up their own.
    findFor(groupId: GroupId, userId: UserId): Promise<ShiftHistoryProposalEntity | null>

    // Every proposal for the group's current members — silently omits any
    // that don't exist, same tolerance as VoteRepository.findReadable.
    findAll(groupId: GroupId, memberUserIds: string[]): Promise<ShiftHistoryProposalEntity[]>
}
