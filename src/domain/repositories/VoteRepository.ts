import { GroupId, UserId, VoteEntity } from '@domain'

// Always public, regardless of the mutual-lock read rule on grade content —
// see firestore.rules. Lets a member see voting progress and enumerate who to
// attempt reading, without exposing anyone's actual grades.
export interface VoteStatus {
    userId: string
    locked: boolean
}

export interface VoteRepository {
    // Create-or-update while unlocked. Rejected by firestore.rules once the
    // caller's own vote is already locked — see VoteEntity.updateGrades.
    saveDraft(vote: VoteEntity): Promise<void>

    // One-way transition — see firestore.rules and VoteEntity.lock.
    lock(groupId: GroupId, userId: UserId): Promise<VoteEntity>

    findMine(groupId: GroupId, userId: UserId): Promise<VoteEntity | null>

    // Attempts every id in memberUserIds; silently omits any whose vote isn't
    // currently readable to the caller (draft, or the caller's own vote isn't
    // locked yet) rather than erroring — see firestore.rules' mutual-lock
    // read rule. The result may be a strict subset of memberUserIds.
    findReadable(groupId: GroupId, memberUserIds: string[]): Promise<VoteEntity[]>

    findStatuses(groupId: GroupId, memberUserIds: string[]): Promise<VoteStatus[]>
}
