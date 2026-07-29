import { Email } from '@domain'

export interface RosterEntryProps {
    email: Email
    displayName: string
}

export class RosterEntry implements RosterEntryProps {
    constructor(
        public readonly email: Email,
        public readonly displayName: string
    ) {}

    static create(email: string, displayName: string): RosterEntry {
        const trimmedName = displayName.trim()
        if (trimmedName.length === 0) {
            throw new Error('Roster entry needs a display name')
        }

        return new RosterEntry(Email.from(email), trimmedName)
    }
}
