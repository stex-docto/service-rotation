import { UserId } from '@domain'

// Private per-user space (see firestore.rules: users/{uid}, readable and
// writable only by that uid) — currently just which groups a member has
// chosen to hide from their own "my groups" list. Purely a personal display
// preference: it never affects group membership, votes, or anyone else.
export interface UserPreferencesRepository {
    getHiddenGroupIds(userId: UserId): Promise<string[]>

    setHiddenGroupIds(userId: UserId, groupIds: string[]): Promise<void>
}
