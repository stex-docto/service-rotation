export abstract class EntityId {
    protected constructor(public readonly value: string) {
        if (!value || value.trim().length === 0) {
            throw new Error('EntityId cannot be empty')
        }
    }

    protected static generateId(): string {
        return crypto.randomUUID()
    }

    equals(other: EntityId): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
