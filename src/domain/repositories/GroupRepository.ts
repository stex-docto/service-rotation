import { GroupEntity, GroupId, MemberEntry, UserId } from '@domain'

export interface GroupRepository {
    // Whole-document overwrite — safe only for creator-only actions (there is
    // never more than one writer). See join/leave for the self-service,
    // racy case.
    save(group: GroupEntity): Promise<void>

    findById(id: GroupId): Promise<GroupEntity | null>

    findCreatedByCurrentUser(): Promise<GroupEntity[]>

    findByMember(userId: UserId): Promise<GroupEntity[]>

    // Read-modify-write against the LATEST group state, not a snapshot the
    // caller already had — two members can join within milliseconds of each
    // other, both racing to append to the same members array. See
    // FirebaseGroupDatastore for why this must be a transaction, not save().
    join(groupId: GroupId, entry: MemberEntry): Promise<GroupEntity>

    leave(groupId: GroupId, userId: UserId): Promise<GroupEntity>

    // Same race as join/leave — a ban and a self-leave/join can land within
    // milliseconds of each other — so this is a transaction too, not save().
    ban(groupId: GroupId, userId: UserId): Promise<GroupEntity>

    subscribe(id: GroupId, callback: (group: GroupEntity | null) => void): () => void

    delete(id: GroupId): Promise<void>
}
