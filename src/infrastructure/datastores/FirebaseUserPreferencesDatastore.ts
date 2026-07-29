import { UserId, UserPreferencesRepository } from '@domain'
import { doc, Firestore, getDoc, setDoc } from 'firebase/firestore'

type FirebaseUserPreferencesDocument = {
    hiddenGroupIds: string[]
}

export class FirebaseUserPreferencesDatastore implements UserPreferencesRepository {
    constructor(private readonly firestore: Firestore) {}

    private docRef(userId: UserId) {
        return doc(this.firestore, 'users', userId.value)
    }

    async getHiddenGroupIds(userId: UserId): Promise<string[]> {
        try {
            const snapshot = await getDoc(this.docRef(userId))
            if (!snapshot.exists()) {
                return []
            }
            return (snapshot.data() as FirebaseUserPreferencesDocument).hiddenGroupIds
        } catch (_err) {
            return []
        }
    }

    async setHiddenGroupIds(userId: UserId, groupIds: string[]): Promise<void> {
        const data: FirebaseUserPreferencesDocument = { hiddenGroupIds: groupIds }
        await setDoc(this.docRef(userId), data)
    }
}
