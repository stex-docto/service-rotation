import { GroupId, ResultEntity, ResultRepository } from '@domain'

export interface GetResultQuery {
    groupId: GroupId
}

export interface GetResultResult {
    result: ResultEntity | null
}

export class GetResultUseCase {
    constructor(private readonly resultRepository: ResultRepository) {}

    async execute(query: GetResultQuery): Promise<GetResultResult> {
        const result = await this.resultRepository.findByGroup(query.groupId)
        return { result }
    }

    subscribe(query: GetResultQuery, callback: (result: GetResultResult) => void): () => void {
        return this.resultRepository.subscribe(query.groupId, result => {
            callback({ result })
        })
    }
}
