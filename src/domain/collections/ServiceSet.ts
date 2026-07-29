import { ServiceEntity, ServiceId } from '@domain'

export class ServiceSet {
    private readonly services: Map<string, ServiceEntity>

    constructor(services: ServiceEntity[] = []) {
        this.services = new Map()
        services.forEach(service => {
            this.services.set(service.id.value, service)
        })
    }

    get size(): number {
        return this.services.size
    }

    get totalCapacity(): number {
        return this.toArray().reduce((sum, service) => sum + service.capacity, 0)
    }

    add(service: ServiceEntity): ServiceSet {
        const newServices = new Map(this.services)
        newServices.set(service.id.value, service)
        return new ServiceSet(Array.from(newServices.values()))
    }

    remove(serviceId: ServiceId): ServiceSet {
        const newServices = new Map(this.services)
        newServices.delete(serviceId.value)
        return new ServiceSet(Array.from(newServices.values()))
    }

    find(serviceId: ServiceId): ServiceEntity | undefined {
        return this.services.get(serviceId.value)
    }

    has(serviceId: ServiceId): boolean {
        return this.services.has(serviceId.value)
    }

    toArray(): ServiceEntity[] {
        return Array.from(this.services.values())
    }

    [Symbol.iterator](): Iterator<ServiceEntity> {
        return this.services.values()
    }
}
