import {
    Email,
    GroupId,
    RosterEntry,
    RosterSet,
    ServiceEntity,
    ServiceId,
    ServiceSet,
    UserId
} from '@domain'

export type GroupStatus = 'draft' | 'open' | 'computed'

export interface Group {
    id: GroupId
    name: string
    rotations: number
    status: GroupStatus
    services: ServiceSet
    roster: RosterSet
    // null until open() resolves it to a concrete number — see open() for why
    // a bare default of 0 would leave the whole rejection mechanism inert.
    maxRejections: number | null
    // Frozen at open() — the source of tie-break determinism. Never regenerated.
    lotterySeed: string | null
    lotteryOrder: string[] | null
    // Grows one email at a time while open (see recordSubmission). Never
    // shrinks — that monotonicity is what lets "everyone has submitted" also
    // serve as the permanent transparency gate once reached (see
    // firestore.rules): no separate compute-vs-transparency distinction needed.
    submittedEmails: string[]
    createdBy: UserId
    createdByEmail: Email
    createdDate: Date
}

export class GroupEntity implements Group {
    constructor(
        public readonly id: GroupId,
        public readonly name: string,
        public readonly rotations: number,
        public readonly status: GroupStatus,
        public readonly services: ServiceSet,
        public readonly roster: RosterSet,
        public readonly maxRejections: number | null,
        public readonly lotterySeed: string | null,
        public readonly lotteryOrder: string[] | null,
        public readonly submittedEmails: string[],
        public readonly createdBy: UserId,
        public readonly createdByEmail: Email,
        public readonly createdDate: Date
    ) {}

    static create(
        name: string,
        rotations: number,
        createdBy: UserId,
        createdByEmail: Email,
        id?: GroupId
    ): GroupEntity {
        if (rotations < 1) {
            throw new Error('A group needs at least one rotation')
        }

        return new GroupEntity(
            id || GroupId.generate(),
            name,
            rotations,
            'draft',
            new ServiceSet(),
            new RosterSet(),
            null,
            null,
            null,
            [],
            createdBy,
            createdByEmail,
            new Date()
        )
    }

    private requireDraft(action: string): void {
        if (this.status !== 'draft') {
            throw new Error(`Cannot ${action}: the group is no longer a draft`)
        }
    }

    updateSettings(options: {
        name?: string
        rotations?: number
        maxRejections?: number
    }): GroupEntity {
        this.requireDraft('update settings')

        const rotations = options.rotations ?? this.rotations
        if (rotations < 1) {
            throw new Error('A group needs at least one rotation')
        }

        const maxRejections = options.maxRejections ?? this.maxRejections
        if (maxRejections !== null && maxRejections < 0) {
            throw new Error('maxRejections cannot be negative')
        }

        return new GroupEntity(
            this.id,
            options.name ?? this.name,
            rotations,
            this.status,
            this.services,
            this.roster,
            maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    addService(service: ServiceEntity): GroupEntity {
        this.requireDraft('add a service')

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services.add(service),
            this.roster,
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    updateService(service: ServiceEntity): GroupEntity {
        this.requireDraft('update a service')
        if (!this.services.has(service.id)) {
            throw new Error('Service not found')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services.add(service),
            this.roster,
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    removeService(serviceId: ServiceId): GroupEntity {
        this.requireDraft('remove a service')
        if (!this.services.has(serviceId)) {
            throw new Error('Service not found')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services.remove(serviceId),
            this.roster,
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    addRosterEntry(entry: RosterEntry): GroupEntity {
        this.requireDraft('add a roster entry')

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services,
            this.roster.add(entry),
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    removeRosterEntry(email: Email): GroupEntity {
        this.requireDraft('remove a roster entry')
        if (!this.roster.has(email)) {
            throw new Error('Roster entry not found')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services,
            this.roster.remove(email),
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    // Freezes services, roster, maxRejections and the tie-break lottery.
    // Everything the matching engine needs becomes immutable from this point
    // on — see firestore.rules. Structural feasibility (service count, roster
    // size) is checked here; the capacity/flow feasibility check (can
    // everyone actually be seated) runs in OpenSubmissionsUseCase, since it
    // needs the matching engine, not just counts.
    //
    // If the organizer never touched maxRejections, it resolves here to
    // services.size - rotations - 1 (floored at 0) rather than staying at a
    // bare 0 — a silent 0 default would make the whole rejection mechanism
    // inert for every group whose organizer didn't think to raise it.
    open(lotterySeed: string, lotteryOrder: string[]): GroupEntity {
        this.requireDraft('open submissions')

        if (this.roster.size === 0) {
            throw new Error('Add at least one intern to the roster before opening')
        }
        if (this.services.size < this.rotations) {
            throw new Error('There must be at least as many services as rotations')
        }
        if (lotteryOrder.length !== this.roster.size) {
            throw new Error('The lottery order must rank every roster entry exactly once')
        }

        const resolvedMaxRejections =
            this.maxRejections ?? Math.max(0, this.services.size - this.rotations - 1)

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            'open',
            this.services,
            this.roster,
            resolvedMaxRejections,
            lotterySeed,
            lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    // Called once per intern as their grade sheet is written. Mirrors the
    // firestore.rules update rule exactly: append-only, own email, no repeats.
    recordSubmission(email: Email): GroupEntity {
        if (this.status !== 'open') {
            throw new Error('Submissions are only accepted while the group is open')
        }
        if (!this.roster.has(email)) {
            throw new Error(`${email.value} is not on this group's roster`)
        }
        if (this.submittedEmails.includes(email.value)) {
            throw new Error(`${email.value} has already submitted`)
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            this.status,
            this.services,
            this.roster,
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            [...this.submittedEmails, email.value],
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    hasSubmitted(email: Email): boolean {
        return this.submittedEmails.includes(email.value)
    }

    allSubmitted(): boolean {
        return this.submittedEmails.length === this.roster.size
    }

    // Grades become world-readable to the roster the moment this fires — see
    // firestore.rules. Not a per-group option: fairness through transparency is
    // a fixed rule of this app, not a setting an organizer can turn off.
    markComputed(): GroupEntity {
        if (this.status !== 'open') {
            throw new Error('Only an open group can be marked as computed')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.rotations,
            'computed',
            this.services,
            this.roster,
            this.maxRejections,
            this.lotterySeed,
            this.lotteryOrder,
            this.submittedEmails,
            this.createdBy,
            this.createdByEmail,
            this.createdDate
        )
    }

    getServices(): ServiceEntity[] {
        return this.services.toArray()
    }

    getRoster(): RosterEntry[] {
        return this.roster.toArray()
    }

    isCreator(userId: UserId): boolean {
        return this.createdBy.equals(userId)
    }
}
