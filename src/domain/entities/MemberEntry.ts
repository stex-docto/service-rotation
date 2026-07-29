import { UserId } from '@domain'

export interface MemberEntryProps {
    userId: UserId
    displayName: string
}

// A self-registered member: no email involved anywhere, by design (see
// README's security model) — userId is a Firebase uid, opaque to every other
// member. displayName is chosen by the member themselves at join time.
export class MemberEntry implements MemberEntryProps {
    constructor(
        public readonly userId: UserId,
        public readonly displayName: string
    ) {}

    static create(userId: string, displayName: string): MemberEntry {
        const trimmedName = displayName.trim()
        if (trimmedName.length === 0) {
            throw new Error('A member needs a display name')
        }

        return new MemberEntry(UserId.from(userId), trimmedName)
    }
}
