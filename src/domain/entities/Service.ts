import { ServiceId } from '@domain'

export interface Service {
    id: ServiceId
    name: string
    description: string
    capacity: number
}

export class ServiceEntity implements Service {
    constructor(
        public readonly id: ServiceId,
        public readonly name: string,
        public readonly description: string,
        public readonly capacity: number
    ) {}

    static create(
        name: string,
        description: string,
        capacity: number,
        id?: ServiceId
    ): ServiceEntity {
        if (capacity < 1) {
            throw new Error('Service capacity must be at least 1')
        }

        return new ServiceEntity(id || ServiceId.generate(), name, description, capacity)
    }

    update(name?: string, description?: string, capacity?: number): ServiceEntity {
        const newCapacity = capacity ?? this.capacity
        if (newCapacity < 1) {
            throw new Error('Service capacity must be at least 1')
        }

        return new ServiceEntity(
            this.id,
            name ?? this.name,
            description ?? this.description,
            newCapacity
        )
    }
}
