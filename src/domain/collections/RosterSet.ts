import { Email, RosterEntry } from '@domain'

export class RosterSet {
    private readonly entries: Map<string, RosterEntry>

    constructor(entries: RosterEntry[] = []) {
        this.entries = new Map()
        entries.forEach(entry => {
            this.entries.set(entry.email.value, entry)
        })
    }

    get size(): number {
        return this.entries.size
    }

    get emails(): string[] {
        return this.toArray().map(entry => entry.email.value)
    }

    add(entry: RosterEntry): RosterSet {
        if (this.entries.has(entry.email.value)) {
            throw new Error(`${entry.email.value} is already on the roster`)
        }

        const newEntries = new Map(this.entries)
        newEntries.set(entry.email.value, entry)
        return new RosterSet(Array.from(newEntries.values()))
    }

    remove(email: Email): RosterSet {
        const newEntries = new Map(this.entries)
        newEntries.delete(email.value)
        return new RosterSet(Array.from(newEntries.values()))
    }

    find(email: Email): RosterEntry | undefined {
        return this.entries.get(email.value)
    }

    has(email: Email): boolean {
        return this.entries.has(email.value)
    }

    toArray(): RosterEntry[] {
        return Array.from(this.entries.values())
    }

    [Symbol.iterator](): Iterator<RosterEntry> {
        return this.entries.values()
    }
}
