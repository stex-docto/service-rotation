import { Grade, GradeLevel, GroupId, UserId, VoteEntity, VoteRepository, VoteStatus } from '@domain'
import {
    doc,
    FieldValue,
    Firestore,
    getDoc,
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore'

type FirebaseVoteDocument = {
    grades: { [serviceId: string]: GradeLevel }
    locked: boolean
    lockedAt: Timestamp | FieldValue | null
}

// Always public, unlike votes/{uid} itself — see VoteRepository.findStatuses
// and firestore.rules. Lets any member see voting progress and know which
// uids are worth attempting a full read on, without exposing grades.
type FirebaseVoteStatusDocument = {
    locked: boolean
}

export class FirebaseVoteDatastore implements VoteRepository {
    constructor(private readonly firestore: Firestore) {}

    private voteRef(groupId: GroupId, userId: string) {
        return doc(this.firestore, 'groups', groupId.value, 'votes', userId)
    }

    private statusRef(groupId: GroupId, userId: string) {
        return doc(this.firestore, 'groups', groupId.value, 'voteStatus', userId)
    }

    async saveDraft(vote: VoteEntity): Promise<void> {
        const voteDoc: FirebaseVoteDocument = {
            grades: Object.fromEntries([...vote.grades].map(([id, grade]) => [id, grade.level])),
            locked: false,
            lockedAt: null
        }
        const statusDoc: FirebaseVoteStatusDocument = { locked: false }

        const batch = writeBatch(this.firestore)
        batch.set(this.voteRef(vote.groupId, vote.userId.value), voteDoc)
        batch.set(this.statusRef(vote.groupId, vote.userId.value), statusDoc)
        await batch.commit()
    }

    async lock(groupId: GroupId, userId: UserId): Promise<VoteEntity> {
        const snapshot = await getDoc(this.voteRef(groupId, userId.value))
        if (!snapshot.exists()) {
            throw new Error('No draft vote to lock')
        }
        const data = snapshot.data() as FirebaseVoteDocument
        if (data.locked) {
            throw new Error('This vote is already locked')
        }

        const batch = writeBatch(this.firestore)
        batch.update(this.voteRef(groupId, userId.value), {
            locked: true,
            lockedAt: serverTimestamp()
        })
        batch.set(this.statusRef(groupId, userId.value), {
            locked: true
        } as FirebaseVoteStatusDocument)
        await batch.commit()

        const grades = new Map(
            Object.entries(data.grades).map(([id, level]) => [id, Grade.from(level)])
        )
        return new VoteEntity(groupId, userId, grades, true, new Date())
    }

    async findMine(groupId: GroupId, userId: UserId): Promise<VoteEntity | null> {
        try {
            const snapshot = await getDoc(this.voteRef(groupId, userId.value))
            if (!snapshot.exists()) {
                return null
            }
            return this.toEntity(groupId, userId, snapshot.data() as FirebaseVoteDocument)
        } catch (_err) {
            return null
        }
    }

    async findReadable(groupId: GroupId, memberUserIds: string[]): Promise<VoteEntity[]> {
        const results = await Promise.all(
            memberUserIds.map(async userId => {
                try {
                    const snapshot = await getDoc(this.voteRef(groupId, userId))
                    if (!snapshot.exists()) {
                        return null
                    }
                    const data = snapshot.data() as FirebaseVoteDocument
                    if (!data.locked) {
                        return null
                    }
                    return this.toEntity(groupId, UserId.from(userId), data)
                } catch (_err) {
                    // Not currently readable (draft, or the caller's own vote
                    // isn't locked yet) — expected, not an error.
                    return null
                }
            })
        )
        return results.filter((vote): vote is VoteEntity => vote !== null)
    }

    async findStatuses(groupId: GroupId, memberUserIds: string[]): Promise<VoteStatus[]> {
        const results = await Promise.all(
            memberUserIds.map(async userId => {
                try {
                    const snapshot = await getDoc(this.statusRef(groupId, userId))
                    if (!snapshot.exists()) {
                        return null
                    }
                    const data = snapshot.data() as FirebaseVoteStatusDocument
                    return { userId, locked: data.locked }
                } catch (_err) {
                    return null
                }
            })
        )
        return results.filter((status): status is VoteStatus => status !== null)
    }

    private toEntity(groupId: GroupId, userId: UserId, data: FirebaseVoteDocument): VoteEntity {
        const grades = new Map(
            Object.entries(data.grades).map(([id, level]) => [id, Grade.from(level)])
        )
        // Always a resolved Timestamp by the time it comes back from a read —
        // the FieldValue sentinel only exists transiently on the client
        // before the write commits.
        const lockedAtValue = data.lockedAt as Timestamp | null
        const lockedAt = data.locked && lockedAtValue ? lockedAtValue.toDate() : null
        return new VoteEntity(groupId, userId, grades, data.locked, lockedAt)
    }
}
