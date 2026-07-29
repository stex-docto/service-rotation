import { EntityId } from './EntityId'

export class ServiceId extends EntityId {
    static generate(): ServiceId {
        return new ServiceId(this.generateId())
    }

    static from(value: string): ServiceId {
        return new ServiceId(value)
    }
}
