import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    MemberEntry,
    UserId
} from '@domain'
import { Auth } from 'firebase/auth'
import {
    collection,
    deleteDoc,
    doc,
    Firestore,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    QueryDocumentSnapshot,
    runTransaction,
    setDoc,
    where
} from 'firebase/firestore'
import { FirebaseGroupDocument, toGroupDocument, toGroupEntity } from './groupMapping'

export class FirebaseGroupDatastore implements GroupRepository {
    constructor(
        private readonly firestore: Firestore,
        private readonly auth: Auth
    ) {}

    protected get collection() {
        return collection(this.firestore, 'groups')
    }

    async save(group: GroupEntity): Promise<void> {
        await setDoc(doc(this.collection, group.id.value), toGroupDocument(group))
    }

    async findById(id: GroupId): Promise<GroupEntity | null> {
        try {
            const snapshot = await getDoc(doc(this.collection, id.value))
            if (!snapshot.exists()) {
                return null
            }
            return toGroupEntity(snapshot.data() as FirebaseGroupDocument)
        } catch (err) {
            console.error(`Error reading group ${id.value}:`, err)
            return null
        }
    }

    // Maps every doc individually rather than a single `.map()` over the
    // whole batch — one document that fails to parse (e.g. an older shape a
    // migration missed) must not blank out every other group in the same
    // list. Logged rather than silently dropped, so a real mapping bug is
    // discoverable instead of just quietly hiding groups from "My groups".
    private mapGroupDocs(docs: QueryDocumentSnapshot[]): GroupEntity[] {
        const groups: GroupEntity[] = []
        for (const docSnapshot of docs) {
            try {
                groups.push(toGroupEntity(docSnapshot.data() as FirebaseGroupDocument))
            } catch (err) {
                console.error(`Skipping unreadable group document ${docSnapshot.id}:`, err)
            }
        }
        return groups
    }

    async findCreatedByCurrentUser(): Promise<GroupEntity[]> {
        const uid = this.auth.currentUser?.uid
        if (!uid) {
            return []
        }

        try {
            const q = query(this.collection, where('createdBy', '==', uid))
            const snapshot = await getDocs(q)
            return this.mapGroupDocs(snapshot.docs)
        } catch (err) {
            console.error('Error querying groups created by current user:', err)
            return []
        }
    }

    async findByMember(userId: UserId): Promise<GroupEntity[]> {
        try {
            const q = query(this.collection, where('memberUids', 'array-contains', userId.value))
            const snapshot = await getDocs(q)
            return this.mapGroupDocs(snapshot.docs)
        } catch (err) {
            console.error('Error querying groups by member:', err)
            return []
        }
    }

    // A transaction, not save(): two members can join within milliseconds of
    // each other, both racing to append to the same members array. Firestore
    // re-runs this function against fresh data if the document changed
    // between the read and the commit attempt, so the second joiner's write
    // is always computed against the true latest state rather than silently
    // clobbering the first.
    async join(groupId: GroupId, entry: MemberEntry): Promise<GroupEntity> {
        const groupRef = doc(this.collection, groupId.value)

        return runTransaction(this.firestore, async transaction => {
            const snapshot = await transaction.get(groupRef)
            if (!snapshot.exists()) {
                throw new GroupNotFoundError()
            }
            const currentGroup = toGroupEntity(snapshot.data() as FirebaseGroupDocument)
            if (currentGroup.isMember(entry.userId)) {
                return currentGroup
            }
            const updatedGroup = currentGroup.join(entry)
            transaction.set(groupRef, toGroupDocument(updatedGroup))
            return updatedGroup
        })
    }

    async leave(groupId: GroupId, userId: UserId): Promise<GroupEntity> {
        const groupRef = doc(this.collection, groupId.value)

        return runTransaction(this.firestore, async transaction => {
            const snapshot = await transaction.get(groupRef)
            if (!snapshot.exists()) {
                throw new GroupNotFoundError()
            }
            const currentGroup = toGroupEntity(snapshot.data() as FirebaseGroupDocument)
            const updatedGroup = currentGroup.leave(userId)
            transaction.set(groupRef, toGroupDocument(updatedGroup))
            return updatedGroup
        })
    }

    // A transaction, not save(): a ban can land within milliseconds of the
    // target self-leaving or someone else joining — see join/leave above.
    async ban(groupId: GroupId, userId: UserId): Promise<GroupEntity> {
        const groupRef = doc(this.collection, groupId.value)

        return runTransaction(this.firestore, async transaction => {
            const snapshot = await transaction.get(groupRef)
            if (!snapshot.exists()) {
                throw new GroupNotFoundError()
            }
            const currentGroup = toGroupEntity(snapshot.data() as FirebaseGroupDocument)
            const updatedGroup = currentGroup.ban(userId)
            transaction.set(groupRef, toGroupDocument(updatedGroup))
            return updatedGroup
        })
    }

    subscribe(id: GroupId, callback: (group: GroupEntity | null) => void): () => void {
        return onSnapshot(
            doc(this.collection, id.value),
            snapshot => {
                if (!snapshot.exists()) {
                    callback(null)
                    return
                }
                try {
                    callback(toGroupEntity(snapshot.data() as FirebaseGroupDocument))
                } catch (error) {
                    console.error('Error mapping group data:', error)
                    callback(null)
                }
            },
            error => {
                console.error('Error in group subscription:', error)
                callback(null)
            }
        )
    }

    async delete(id: GroupId): Promise<void> {
        await deleteDoc(doc(this.collection, id.value))
    }
}
