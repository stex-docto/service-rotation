import { EntityId } from './EntityId'

export class GroupId extends EntityId {
    static generate(): GroupId {
        return new GroupId(this.generateId())
    }

    static from(value: string): GroupId {
        return new GroupId(value)
    }
}
