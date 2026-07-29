import { MemberEntry, UserId } from '@domain'

export class MemberSet {
    private readonly entries: Map<string, MemberEntry>

    constructor(entries: MemberEntry[] = []) {
        this.entries = new Map()
        entries.forEach(entry => {
            this.entries.set(entry.userId.value, entry)
        })
    }

    get size(): number {
        return this.entries.size
    }

    get userIds(): string[] {
        return this.toArray().map(entry => entry.userId.value)
    }

    add(entry: MemberEntry): MemberSet {
        if (this.entries.has(entry.userId.value)) {
            throw new Error(`${entry.userId.value} is already a member`)
        }

        const newEntries = new Map(this.entries)
        newEntries.set(entry.userId.value, entry)
        return new MemberSet(Array.from(newEntries.values()))
    }

    remove(userId: UserId): MemberSet {
        const newEntries = new Map(this.entries)
        newEntries.delete(userId.value)
        return new MemberSet(Array.from(newEntries.values()))
    }

    find(userId: UserId): MemberEntry | undefined {
        return this.entries.get(userId.value)
    }

    has(userId: UserId): boolean {
        return this.entries.has(userId.value)
    }

    toArray(): MemberEntry[] {
        return Array.from(this.entries.values())
    }

    [Symbol.iterator](): Iterator<MemberEntry> {
        return this.entries.values()
    }
}
