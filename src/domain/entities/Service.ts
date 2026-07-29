import { ServiceId } from '@domain'

export interface Service {
    id: ServiceId
    name: string
    description: string
    capacity: number
    // Assigned once, by Group.addService, and never changed afterward.
    // Firestore stores `services` as a map keyed by id (unlike the
    // `members`/`rotationSlots` arrays), and a map field's key order isn't
    // guaranteed to survive a round trip — this is what keeps the list in
    // creation order across a reload. Never shown in the UI.
    sortOrder: number
}

export class ServiceEntity implements Service {
    constructor(
        public readonly id: ServiceId,
        public readonly name: string,
        public readonly description: string,
        public readonly capacity: number,
        public readonly sortOrder: number
    ) {}

    // sortOrder defaults to 0 here and is always overwritten by
    // Group.addService, which is the only place that knows the current
    // maximum across existing services — never trust a caller-supplied
    // value for it.
    static create(
        name: string,
        description: string,
        capacity: number,
        id?: ServiceId,
        sortOrder = 0
    ): ServiceEntity {
        if (capacity < 1) {
            throw new Error('Service capacity must be at least 1')
        }

        return new ServiceEntity(id || ServiceId.generate(), name, description, capacity, sortOrder)
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
            newCapacity,
            this.sortOrder
        )
    }
}
