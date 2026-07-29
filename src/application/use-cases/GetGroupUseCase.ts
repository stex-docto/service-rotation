import { GroupEntity, GroupId, GroupRepository } from '@domain'

export interface GetGroupQuery {
    groupId: GroupId
}

export interface GetGroupResult {
    group: GroupEntity | null
}

export class GetGroupUseCase {
    constructor(private readonly groupRepository: GroupRepository) {}

    async execute(query: GetGroupQuery): Promise<GetGroupResult> {
        const group = await this.groupRepository.findById(query.groupId)
        return { group }
    }

    subscribe(query: GetGroupQuery, callback: (result: GetGroupResult) => void): () => void {
        return this.groupRepository.subscribe(query.groupId, group => {
            callback({ group })
        })
    }
}
