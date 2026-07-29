import { CurrentUser, Email, UserId, UserRepository } from '@domain'
import {
    Auth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    User
} from 'firebase/auth'

function toCurrentUser(user: User): CurrentUser {
    if (!user.email) {
        throw new Error('This Google account has no email address on file')
    }
    return {
        id: UserId.from(user.uid),
        email: Email.from(user.email),
        displayName: user.displayName || user.email
    }
}

export class FirebaseUserDatastore implements UserRepository {
    // Firebase restores a persisted session asynchronously on page load —
    // reading `auth.currentUser` before that finishes returns null even for
    // an already-signed-in user. getCurrentUser() waits for the first auth
    // state callback so it never races ahead of that restoration.
    private readonly authReady: Promise<void>

    constructor(private readonly auth: Auth) {
        this.authReady = new Promise(resolve => {
            const unsubscribe = onAuthStateChanged(this.auth, () => {
                unsubscribe()
                resolve()
            })
        })
    }

    async getCurrentUser(): Promise<CurrentUser | null> {
        await this.authReady
        const user = this.auth.currentUser
        return user ? toCurrentUser(user) : null
    }

    async signInWithGoogle(): Promise<CurrentUser> {
        const credential = await signInWithPopup(this.auth, new GoogleAuthProvider())
        return toCurrentUser(credential.user)
    }

    async signOut(): Promise<void> {
        await firebaseSignOut(this.auth)
    }

    onAuthStateChanged(callback: (user: CurrentUser | null) => void): () => void {
        return onAuthStateChanged(this.auth, user => {
            callback(user ? toCurrentUser(user) : null)
        })
    }
}
