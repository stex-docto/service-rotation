import { GroupId, ResultEntity } from '@domain'
import { ComputeResultUseCase } from '@application/use-cases/ComputeResultUseCase'

export interface CloseSubmissionsCommand {
    groupId: GroupId
}

export interface CloseSubmissionsResult {
    result: ResultEntity
}

// The organizer's escape hatch for a straggler who never submits. Thin
// wrapper: all the actual logic (permission check, treating non-submitters
// as indifferent, the create-once race) lives in ComputeResultUseCase.
export class CloseSubmissionsUseCase {
    constructor(private readonly computeResultUseCase: ComputeResultUseCase) {}

    async execute(command: CloseSubmissionsCommand): Promise<CloseSubmissionsResult> {
        return this.computeResultUseCase.execute({
            groupId: command.groupId,
            forcedByOrganizer: true
        })
    }
}
