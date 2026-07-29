import { GroupId, ResultEntity } from '@domain'

export interface ResultRepository {
    // Create-only — see firestore.rules. Whoever's browser observes the last
    // submission computes and writes this; everyone else only ever reads it.
    save(result: ResultEntity): Promise<void>

    findByGroup(groupId: GroupId): Promise<ResultEntity | null>

    subscribe(groupId: GroupId, callback: (result: ResultEntity | null) => void): () => void
}
