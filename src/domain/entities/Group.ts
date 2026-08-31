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
    // Whether a student may be assigned the same service more than once —
    // false by default, matching the classic "k distinct services" contract.
    // Only meaningful once services.length < rotations; otherwise the
    // matching engine never needs to repeat anyway. See assign.ts's
    // allowRepeatedServices and checkStructuralFeasibility.
    allowRepeatedServices: boolean
    // Whether the invite link still accepts new self-joins — true from
    // creation, in both 'draft' and 'open'. Only the creator can lock it —
    // see closeInvite — but it's group configuration, not a standing
    // privilege over anyone's vote: locking it only stops new joins.
    inviteOpen: boolean
    // Members forcibly removed by the creator (see ban/unban below) — kept
    // as a MemberSet, not just uids, so a banned member's display name is
    // still available to the creator (e.g. to undo a misclick). Checked by
    // join() so a banned uid can't simply rejoin through the normal
    // self-service flow.
    bannedMembers: MemberSet
    createdBy: UserId
    createdDate: Date
    // The group this one was cloned from, if any — set once at creation,
    // never changed afterward (see CreateGroupUseCase). Purely informational
    // provenance: it grants no extra read access (any signed-in user holding
    // a group id can already `get` it) and drives nothing on its own — it's
    // what a future "import shift history" feature will read from.
    predecessorGroupId: GroupId | null
    // Whether per-service "shifts already done" counts are tracked for this
    // group. Draft-only setting, like allowRepeatedServices. Independent of
    // predecessorGroupId — usable standalone (organizer types the numbers
    // in) or left off on a cloned group.
    pastShiftsEnabled: boolean
    // uid -> serviceId -> shifts already done, before this cycle started.
    // Organizer-owned: entered by the creator while still a draft, public to
    // every member from the moment it's entered (this is the group
    // document, already readable by anyone holding the link), frozen at
    // open alongside services and rotations. Deliberately NOT self-reported
    // by members — an unverified self-reported count would be a free,
    // unbounded lever on top of the bounded, self-punishing grade (see
    // README). Stale entries for a member who later left or was banned are
    // harmless and ignored, same as an orphaned vote.
    shiftHistory: Map<string, Map<string, number>>
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
        public readonly allowRepeatedServices: boolean,
        public readonly inviteOpen: boolean,
        public readonly bannedMembers: MemberSet,
        public readonly createdBy: UserId,
        public readonly createdDate: Date,
        public readonly predecessorGroupId: GroupId | null,
        public readonly pastShiftsEnabled: boolean,
        public readonly shiftHistory: Map<string, Map<string, number>>
    ) {}

    // How many rotations each member goes through — always exactly the
    // number of slots, never tracked separately, so the two can never drift.
    get rotations(): number {
        return this.rotationSlots.length
    }

    static create(
        name: string,
        createdBy: UserId,
        id?: GroupId,
        predecessorGroupId: GroupId | null = null
    ): GroupEntity {
        return new GroupEntity(
            id || GroupId.generate(),
            name,
            'draft',
            new ServiceSet(),
            new MemberSet(),
            [],
            'name',
            false,
            true,
            new MemberSet(),
            createdBy,
            new Date(),
            predecessorGroupId,
            false,
            new Map()
        )
    }

    private requireDraft(action: string): void {
        if (this.status !== 'draft') {
            throw new Error(`Cannot ${action}: the group is no longer a draft`)
        }
    }

    updateSettings(options: {
        name?: string
        allowRepeatedServices?: boolean
        pastShiftsEnabled?: boolean
    }): GroupEntity {
        this.requireDraft('update settings')

        return new GroupEntity(
            this.id,
            options.name ?? this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            options.allowRepeatedServices ?? this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            options.pastShiftsEnabled ?? this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    // Stamps sortOrder as one past the current maximum — the only place
    // that knows it, since it depends on every existing service, not just
    // the new one. Any sortOrder the caller passed in is discarded.
    addService(service: ServiceEntity): GroupEntity {
        this.requireDraft('add a service')

        const maxOrder = this.services
            .toArray()
            .reduce((max, existing) => Math.max(max, existing.sortOrder), -1)
        const orderedService = new ServiceEntity(
            service.id,
            service.name,
            service.description,
            service.capacity,
            maxOrder + 1
        )

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services.add(orderedService),
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
        if (this.services.size === 0) {
            throw new Error('Add at least one service before opening')
        }
        if (!this.allowRepeatedServices && this.services.size < this.rotations) {
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
            this.allowRepeatedServices,
            false,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
        if (this.bannedMembers.has(entry.userId)) {
            throw new Error('You have been removed from this group and cannot rejoin')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members.add(entry),
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    // Creator-initiated forced removal — unlike leave(), also records the
    // entry in bannedMembers so join() rejects any future self-rejoin
    // attempt. Distinct from leave() precisely for that reason: a voluntary
    // self-removal leaves no such trace.
    ban(userId: UserId): GroupEntity {
        const entry = this.members.find(userId)
        if (!entry) {
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
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers.add(entry),
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    // The creator's misclick undo — reachable only while the roster itself
    // isn't locked (inviteOpen). Once locked there's no point undoing a ban:
    // the person couldn't rejoin anyway, and once voting has started
    // inviteOpen can never reopen regardless (see reopenInvite). This does
    // NOT restore membership — the unbanned uid still has to rejoin
    // themselves through the normal self-service flow.
    unban(userId: UserId): GroupEntity {
        if (!this.inviteOpen) {
            throw new Error('Cannot unban while the roster is locked')
        }
        if (!this.bannedMembers.has(userId)) {
            throw new Error('This member is not banned')
        }

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers.remove(userId),
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    // The creator's one standing privilege over membership: stop the roster
    // from growing further. Gates joining only — a member can still leave
    // (see the vote-lock check on leave above) and the creator can still ban
    // regardless. Usable in 'draft' or 'open': locking membership is
    // independent of whether voting has been enabled. Reversible via
    // reopenInvite — but only while still 'draft', see there.
    closeInvite(): GroupEntity {
        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            false,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    // Draft-only, unlike closeInvite: once voting is enabled the roster is
    // locked for good (open() already forces inviteOpen false), so nobody
    // can join after other members have started grading — new joins mid-
    // vote would be unfair to whoever already committed to the current
    // member list. There is deliberately no way back to true past this
    // point.
    reopenInvite(): GroupEntity {
        this.requireDraft('reopen the invite')

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            true,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            this.shiftHistory
        )
    }

    getServices(): ServiceEntity[] {
        return this.services.toArray()
    }

    getMembers(): MemberEntry[] {
        return this.members.toArray()
    }

    getBannedMembers(): MemberEntry[] {
        return this.bannedMembers.toArray()
    }

    getShiftHistoryFor(userId: UserId): Map<string, number> {
        return this.shiftHistory.get(userId.value) ?? new Map()
    }

    // Replaces one member's whole row — used both for a manual organizer
    // edit and, once proposals exist, for accepting one. Whole-row rather
    // than per-service so a single autosave can't leave the row half
    // updated if a caller only has a partial map.
    setMemberShiftHistory(userId: UserId, counts: Map<string, number>): GroupEntity {
        this.requireDraft("set a member's shift history")
        if (!this.members.has(userId)) {
            throw new Error('Not a member of this group')
        }

        const nextHistory = new Map(this.shiftHistory)
        nextHistory.set(userId.value, new Map(counts))

        return new GroupEntity(
            this.id,
            this.name,
            this.status,
            this.services,
            this.members,
            this.rotationSlots,
            this.rotationMode,
            this.allowRepeatedServices,
            this.inviteOpen,
            this.bannedMembers,
            this.createdBy,
            this.createdDate,
            this.predecessorGroupId,
            this.pastShiftsEnabled,
            nextHistory
        )
    }

    isCreator(userId: UserId): boolean {
        return this.createdBy.equals(userId)
    }

    isMember(userId: UserId): boolean {
        return this.members.has(userId)
    }

    isBanned(userId: UserId): boolean {
        return this.bannedMembers.has(userId)
    }
}
