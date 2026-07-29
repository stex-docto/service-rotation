import { CurrentUser, SignInRequiredError, UserRepository } from '@domain'

export class SignInUseCase {
    constructor(private readonly userRepository: UserRepository) {}

    async signInWithGoogle(): Promise<CurrentUser> {
        return this.userRepository.signInWithGoogle()
    }

    async signInAnonymously(): Promise<CurrentUser> {
        return this.userRepository.signInAnonymously()
    }

    async signOut(): Promise<void> {
        return this.userRepository.signOut()
    }

    async getCurrentUser(): Promise<CurrentUser | null> {
        return this.userRepository.getCurrentUser()
    }

    async requireCurrentUser(): Promise<CurrentUser> {
        const user = await this.userRepository.getCurrentUser()
        if (!user) {
            throw new SignInRequiredError()
        }
        return user
    }

    onAuthStateChanged(callback: (user: CurrentUser | null) => void): () => void {
        return this.userRepository.onAuthStateChanged(callback)
    }
}
