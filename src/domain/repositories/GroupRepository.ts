import { Email, GroupEntity, GroupId } from '@domain'

export interface GroupRepository {
    save(group: GroupEntity): Promise<void>

    findById(id: GroupId): Promise<GroupEntity | null>

    findCreatedByCurrentUser(): Promise<GroupEntity[]>

    findByParticipantEmail(email: Email): Promise<GroupEntity[]>

    subscribe(id: GroupId, callback: (group: GroupEntity | null) => void): () => void

    delete(id: GroupId): Promise<void>
}
