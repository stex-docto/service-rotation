import { Email, UserId } from '@domain'

export interface CurrentUser {
    id: UserId
    email: Email
    displayName: string
}

export interface UserRepository {
    getCurrentUser(): Promise<CurrentUser | null>

    signInWithGoogle(): Promise<CurrentUser>

    signOut(): Promise<void>

    onAuthStateChanged(callback: (user: CurrentUser | null) => void): () => void
}
