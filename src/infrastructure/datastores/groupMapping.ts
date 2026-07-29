import {
    GroupEntity,
    GroupId,
    GroupStatus,
    MemberEntry,
    MemberSet,
    RotationMode,
    RotationSlot,
    ServiceEntity,
    ServiceId,
    ServiceSet,
    UserId
} from '@domain'

export type FirebaseServiceDocument = {
    id: string
    name: string
    description: string
    capacity: number
    // Optional only for documents written before this field existed — see
    // Service.ts. Always written from here on.
    sortOrder?: number
}

export type FirebaseMemberEntryDocument = {
    userId: string
    displayName: string
}

// Legacy shape from before rotation slots existed — kept only so
// toGroupEntity can migrate an old document on read. Never written any more.
type LegacyRotationPeriod = {
    startDate: string | null
    endDate: string | null
}

export type FirebaseGroupDocument = {
    id: string
    name: string
    status: GroupStatus
    services: { [serviceId: string]: FirebaseServiceDocument }
    members: FirebaseMemberEntryDocument[]
    memberUids: string[]
    rotationSlots?: RotationSlot[]
    rotationMode?: RotationMode
    // Legacy fields from before rotation slots existed — see toGroupEntity's
    // fallback. Never written by this version of the app.
    rotations?: number
    rotationPeriods?: LegacyRotationPeriod[]
    // Optional only for documents written before this setting existed — see
    // toGroupEntity's fallback (defaults to false). Always written from here
    // on.
    allowRepeatedServices?: boolean
    inviteOpen: boolean
    // Optional only for documents written before banning existed — see
    // toGroupEntity's fallback. Always written from here on.
    bannedMembers?: FirebaseMemberEntryDocument[]
    bannedUids?: string[]
    createdBy: string
    createdDate: string
}

// Shared by FirebaseGroupDatastore and FirebaseVoteDatastore (the latter
// writes an updated group document as part of the same transaction as a
// join/leave — see GroupRepository) so the two never drift into producing
// subtly different documents for the same entity.
export function toGroupDocument(group: GroupEntity): FirebaseGroupDocument {
    const services: { [serviceId: string]: FirebaseServiceDocument } = {}
    for (const service of group.getServices()) {
        services[service.id.value] = {
            id: service.id.value,
            name: service.name,
            description: service.description,
            capacity: service.capacity,
            sortOrder: service.sortOrder
        }
    }

    // Preserve member ARRAY ORDER exactly (getMembers() iterates the
    // underlying Map in insertion order, which for an entity freshly read via
    // toGroupEntity matches Firestore's stored array order). The join/leave
    // security rule diffs the whole document against what's stored, so an
    // incidental reordering here would make an unrelated field look
    // "changed" and the write would be rejected.
    const members: FirebaseMemberEntryDocument[] = group
        .getMembers()
        .map(entry => ({ userId: entry.userId.value, displayName: entry.displayName }))
    const bannedMembers: FirebaseMemberEntryDocument[] = group
        .getBannedMembers()
        .map(entry => ({ userId: entry.userId.value, displayName: entry.displayName }))

    return {
        id: group.id.value,
        name: group.name,
        status: group.status,
        services,
        members,
        memberUids: members.map(entry => entry.userId),
        rotationSlots: group.rotationSlots,
        rotationMode: group.rotationMode,
        allowRepeatedServices: group.allowRepeatedServices,
        inviteOpen: group.inviteOpen,
        bannedMembers,
        bannedUids: bannedMembers.map(entry => entry.userId),
        createdBy: group.createdBy.value,
        createdDate: group.createdDate.toISOString()
    }
}

// Falls back through progressively older shapes so a document from any
// point in this app's (fast-moving) history still loads instead of
// crashing: current rotationSlots, then the one-off rotations+rotationPeriods
// shape, then a single empty slot for anything even older than that.
function deriveRotationSlots(data: FirebaseGroupDocument): RotationSlot[] {
    if (data.rotationSlots) {
        return data.rotationSlots
    }
    if (data.rotations !== undefined) {
        const periods = data.rotationPeriods ?? []
        return Array.from({ length: data.rotations }, (_, i) => ({
            name: null,
            startDate: periods[i]?.startDate ?? null,
            endDate: periods[i]?.endDate ?? null
        }))
    }
    return [{ name: null, startDate: null, endDate: null }]
}

export function toGroupEntity(data: FirebaseGroupDocument): GroupEntity {
    const services = new ServiceSet(
        Object.values(data.services).map(
            service =>
                new ServiceEntity(
                    ServiceId.from(service.id),
                    service.name,
                    service.description,
                    service.capacity,
                    service.sortOrder ?? 0
                )
        )
    )
    // Direct array map — see the ordering note in toGroupDocument above.
    const members = new MemberSet(
        data.members.map(entry => new MemberEntry(UserId.from(entry.userId), entry.displayName))
    )
    const bannedMembers = new MemberSet(
        (data.bannedMembers ?? []).map(
            entry => new MemberEntry(UserId.from(entry.userId), entry.displayName)
        )
    )

    return new GroupEntity(
        GroupId.from(data.id),
        data.name,
        data.status,
        services,
        members,
        deriveRotationSlots(data),
        data.rotationMode ?? 'name',
        data.allowRepeatedServices ?? false,
        data.inviteOpen,
        bannedMembers,
        UserId.from(data.createdBy),
        new Date(data.createdDate)
    )
}
