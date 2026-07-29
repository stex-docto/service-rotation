import { GroupEntity, GroupId, GroupNotFoundError, GroupRepository, PermissionError } from '@domain'
import { checkStructuralFeasibility } from '@domain/matching'
import { SignInUseCase } from '@application'

export interface OpenGroupCommand {
    groupId: GroupId
}

export interface OpenGroupResult {
    group: GroupEntity
}

// Freezes services/rotations and opens the invite link for self-service
// joining and voting. There is no roster to pre-populate and no lottery to
// pre-commit any more — see Group.open and lottery.ts.
export class OpenGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: OpenGroupCommand): Promise<OpenGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can open the group')
        }

        const feasibility = checkStructuralFeasibility(
            group.getServices().map(service => ({
                serviceId: service.id.value,
                capacityPerRotation: service.capacity
            })),
            group.rotations
        )
        if (!feasibility.feasible) {
            throw new Error(
                `Cannot open the group: ${feasibility.reason ?? 'no valid schedule exists for these services and rotations.'}`
            )
        }

        const updatedGroup = group.open()

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
