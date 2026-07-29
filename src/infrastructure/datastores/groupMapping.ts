import {
    Email,
    GroupEntity,
    GroupId,
    GroupStatus,
    RosterEntry,
    RosterSet,
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
}

export type FirebaseRosterEntryDocument = {
    email: string
    displayName: string
}

export type FirebaseGroupDocument = {
    id: string
    name: string
    rotations: number
    status: GroupStatus
    services: { [serviceId: string]: FirebaseServiceDocument }
    roster: FirebaseRosterEntryDocument[]
    rosterEmails: string[]
    maxRejections: number | null
    lotterySeed: string | null
    lotteryOrder: string[] | null
    submittedEmails: string[]
    createdBy: string
    createdByEmail: string
    createdDate: string
}

// Shared by FirebaseGroupDatastore and FirebaseSubmissionDatastore (the
// latter writes an updated group document as part of the same batch as a
// submission — see SubmissionRepository.submit) so the two never drift into
// producing subtly different documents for the same entity.
export function toGroupDocument(group: GroupEntity): FirebaseGroupDocument {
    const services: { [serviceId: string]: FirebaseServiceDocument } = {}
    for (const service of group.getServices()) {
        services[service.id.value] = {
            id: service.id.value,
            name: service.name,
            description: service.description,
            capacity: service.capacity
        }
    }

    // Preserve roster ARRAY ORDER exactly (getRoster() iterates the
    // underlying Map in insertion order, which for an entity freshly read
    // via toGroupEntity matches Firestore's stored array order). The
    // submission-recording security rule diffs the whole document against
    // what's stored, so an incidental reordering here would make an
    // unrelated field look "changed" and the write would be rejected.
    const roster: FirebaseRosterEntryDocument[] = group
        .getRoster()
        .map(entry => ({ email: entry.email.value, displayName: entry.displayName }))

    return {
        id: group.id.value,
        name: group.name,
        rotations: group.rotations,
        status: group.status,
        services,
        roster,
        rosterEmails: roster.map(entry => entry.email),
        maxRejections: group.maxRejections,
        lotterySeed: group.lotterySeed,
        lotteryOrder: group.lotteryOrder,
        submittedEmails: group.submittedEmails,
        createdBy: group.createdBy.value,
        createdByEmail: group.createdByEmail.value,
        createdDate: group.createdDate.toISOString()
    }
}

export function toGroupEntity(data: FirebaseGroupDocument): GroupEntity {
    const services = new ServiceSet(
        Object.values(data.services).map(
            service =>
                new ServiceEntity(
                    ServiceId.from(service.id),
                    service.name,
                    service.description,
                    service.capacity
                )
        )
    )
    // Direct array map — see the ordering note in toGroupDocument above.
    const roster = new RosterSet(
        data.roster.map(entry => new RosterEntry(Email.from(entry.email), entry.displayName))
    )

    return new GroupEntity(
        GroupId.from(data.id),
        data.name,
        data.rotations,
        data.status,
        services,
        roster,
        data.maxRejections,
        data.lotterySeed,
        data.lotteryOrder,
        data.submittedEmails,
        UserId.from(data.createdBy),
        Email.from(data.createdByEmail),
        new Date(data.createdDate)
    )
}
