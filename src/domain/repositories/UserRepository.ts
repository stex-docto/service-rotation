import { Email, UserId } from '@domain'

export interface CurrentUser {
    id: UserId
    email: Email | null
    displayName: string
}

export interface UserRepository {
    getCurrentUser(): Promise<CurrentUser | null>

    signInWithGoogle(): Promise<CurrentUser>

    // Dev-only: Firebase Anonymous Authentication, enabled on the dev
    // project only so testers can spin up throwaway accounts locally.
    signInAnonymously(): Promise<CurrentUser>

    signOut(): Promise<void>

    onAuthStateChanged(callback: (user: CurrentUser | null) => void): () => void
}
