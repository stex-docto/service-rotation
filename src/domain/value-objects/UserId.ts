import { EntityId } from './EntityId'

export class UserId extends EntityId {
    static generate(): UserId {
        return new UserId(this.generateId())
    }

    static from(value: string): UserId {
        return new UserId(value)
    }
}
