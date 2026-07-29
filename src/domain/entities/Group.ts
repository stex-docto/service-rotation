import {
    GroupId,
    MemberEntry,
    MemberSet,
    ServiceEntity,
    ServiceId,
    ServiceSet,
    UserId
} from '@domain'

export type GroupStatus = 'draft' | 'open'

// Either 'name' the rotation slots yourself (e.g. "Automne") or attach a
// calendar date range to each — never both displayed at once. Purely
// cosmetic: the matching engine only ever cares how many slots there are.
export type RotationMode = 'name' | 'date'

export interface RotationSlot {
    name: string | null
    startDate: string | null
    endDate: string | null
}

function emptyRotationSlot(): RotationSlot {
    return { name: null, startDate: null, endDate: null }
}

export interface Group {
    id: GroupId
    name: string
    status: GroupStatus
    services: ServiceSet
    members: MemberSet
    rotationSlots: RotationSlot[]
    rotationMode: RotationMode
    // Whether the invite link still accepts new self-joins — true from
    // creation, in both 'draft' and 'open'. Only the creator can lock it —
    // see closeInvite — but it's group configuration, not a standing
    // privilege over anyone's vote: locking it only stops new joins.
    inviteOpen: boolean
    createdBy: UserId
    createdDate: Date
}

export class GroupEntity implements Group {
    constructor(
        public readonly id: GroupId,
        public readonly name: string,
        public readonly status: GroupStatus,
        public readonly services: ServiceSet,
        public readonly members: MemberSet,
        public readonly rotationSlots: RotationSlot[],
        public readonly rotationMode: RotationMode,
        public readonly inviteOpen: boolean,
        public readonly createdBy: UserId,
        public readonly createdDate: Date
    ) {}

    // How many rotations each member goes through — always exactly the
    // number of slots, never tracked separately, so the two can never drift.
    get rotations(): number {
        return this.rotationSlots.length
    }

    static create(name: string, createdBy: UserId, id?: GroupId): GroupEntity {
        return new GroupEntity(
            id || GroupId.generate(),
            name,
            'draft',
            new ServiceSet(),
            new MemberSet(),
            [],
            'name',
            true,
            createdBy,
            new Date()
        )
    }

    private requireDraft(action: string): void {
        if (this.status !== 'draft') {
            throw new Error(`Cannot ${action}: the group is no longer a draft`)
        }
    }

    updateSettings(options: { name?: string }): GroupEntity {
        this.requireDraft('update settings')

        return new GroupEntity(
            this.id,
            options.name ?? this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    addService(service: ServiceEntity): GroupEntity {
        this.requireDraft('add a service')

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services.add(service),
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
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
            this.status,
            this.services.add(service),
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
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
            this.status,
            this.services.remove(serviceId),
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    addRotationSlot(): GroupEntity {
        this.requireDraft('add a rotation')

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            [...this.rotationSlots, emptyRotationSlot()],
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    removeRotationSlot(index: number): GroupEntity {
        this.requireDraft('remove a rotation')
        if (index < 0 || index >= this.rotationSlots.length) {
            throw new Error('Rotation not found')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots.filter((_, i) => i !== index),
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    updateRotationSlot(index: number, changes: Partial<RotationSlot>): GroupEntity {
        this.requireDraft('update a rotation')
        if (index < 0 || index >= this.rotationSlots.length) {
            throw new Error('Rotation not found')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots.map((slot, i) => (i === index ? { ...slot, ...changes } : slot)),
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    // Switching mode never touches the other mode's data — flip back and
    // forth without losing anything already entered.
    setRotationMode(mode: RotationMode): GroupEntity {
        this.requireDraft('change the rotation mode')

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            mode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    // Freezes services and rotation slots — everything the matching engine
    // needs about the group's shape becomes immutable from this point on, so
    // a vote cast against today's services/rotations keeps meaning the same
    // thing forever. Also locks the roster (inviteOpen: false): activating
    // voting is naturally the moment most organizers want the member list to
    // stop moving, so that's the default rather than something they have to
    // remember to do separately. Reversible — the creator can still reopen
    // joining afterward via reopenInvite, same as any other time.
    open(): GroupEntity {
        this.requireDraft('open the group')

        if (this.rotationSlots.length === 0) {
            throw new Error('Add at least one rotation before opening')
        }
        if (this.services.size < this.rotations) {
            throw new Error('There must be at least as many services as rotations')
        }

        return new GroupEntity(
            this.id,
            this.name,
            'open',
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            false,
            this.createdBy,
            this.createdDate
        )
    }

    // Self-service: any signed-in user can add themselves given the group's
    // link, while the invite is open — draft or open, voting doesn't need to
    // be enabled yet. Mirrors the firestore.rules delta check exactly —
    // append-only, exactly your own entry.
    join(entry: MemberEntry): GroupEntity {
        if (!this.inviteOpen) {
            throw new Error('This group is no longer accepting new members')
        }
        if (this.members.has(entry.userId)) {
            throw new Error('Already a member of this group')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members.add(entry),
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    // Removes a member — used both for voluntary self-removal and for a
    // creator-initiated ban. Which of those a caller may do, and under what
    // conditions (e.g. a self-leaver's vote must not already be locked), is
    // enforced by the use case, not here — this entity only knows how to
    // shrink the roster by one entry.
    leave(userId: UserId): GroupEntity {
        if (!this.members.has(userId)) {
            throw new Error('Not a member of this group')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members.remove(userId),
            this.rotationSlots,
            this.rotationMode,
            this.inviteOpen,
            this.createdBy,
            this.createdDate
        )
    }

    // The creator's one standing privilege over membership: stop the roster
    // from growing further. Gates joining only — a member can still leave
    // (see the vote-lock check on leave above) and the creator can still ban
    // regardless. Usable in 'draft' or 'open': locking membership is
    // independent of whether voting has been enabled. Reversible — see
    // reopenInvite.
    closeInvite(): GroupEntity {
        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            false,
            this.createdBy,
            this.createdDate
        )
    }

    reopenInvite(): GroupEntity {
        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            true,
            this.createdBy,
            this.createdDate
        )
    }

    getServices(): ServiceEntity[] {
        return this.services.toArray()
    }

    getMembers(): MemberEntry[] {
        return this.members.toArray()
    }

    isCreator(userId: UserId): boolean {
        return this.createdBy.equals(userId)
    }

    isMember(userId: UserId): boolean {
        return this.members.has(userId)
    }
}
