import { Email, GroupEntity, GroupId, GroupRepository } from '@domain'
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
        } catch (_err) {
            return null
        }
    }

    async findCreatedByCurrentUser(): Promise<GroupEntity[]> {
        const uid = this.auth.currentUser?.uid
        if (!uid) {
            return []
        }

        try {
            const q = query(this.collection, where('createdBy', '==', uid))
            const snapshot = await getDocs(q)
            return snapshot.docs.map(docSnapshot =>
                toGroupEntity(docSnapshot.data() as FirebaseGroupDocument)
            )
        } catch (_err) {
            return []
        }
    }

    async findByParticipantEmail(email: Email): Promise<GroupEntity[]> {
        try {
            const q = query(this.collection, where('rosterEmails', 'array-contains', email.value))
            const snapshot = await getDocs(q)
            return snapshot.docs.map(docSnapshot =>
                toGroupEntity(docSnapshot.data() as FirebaseGroupDocument)
            )
        } catch (_err) {
            return []
        }
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
