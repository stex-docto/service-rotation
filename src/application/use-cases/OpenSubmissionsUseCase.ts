import {
    generateLotterySeed,
    deriveLotteryOrder,
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError
} from '@domain'
import { checkStructuralFeasibility } from '@domain/matching'
import { SignInUseCase } from '@application'

export interface OpenSubmissionsCommand {
    groupId: GroupId
}

export interface OpenSubmissionsResult {
    group: GroupEntity
}

export class OpenSubmissionsUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: OpenSubmissionsCommand): Promise<OpenSubmissionsResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can open submissions')
        }

        const rosterEmails = group.getRoster().map(entry => entry.email.value)

        // Structural feasibility (capacity/scheduling), checked BEFORE any real
        // grades exist — see checkStructuralFeasibility's own documentation for
        // what this does and does not catch.
        const feasibility = checkStructuralFeasibility(
            group.getServices().map(service => ({
                serviceId: service.id.value,
                capacityPerRotation: service.capacity
            })),
            group.rotations,
            rosterEmails
        )
        if (!feasibility.feasible) {
            throw new Error(
                `Cannot open submissions: ${feasibility.reason ?? 'no valid schedule exists for these services and rotations.'}`
            )
        }

        // Committed BEFORE submissions open, and immutable thereafter (see
        // firestore.rules) — this is what lets the eventual computation be
        // recomputed and verified by anyone, not just trusted after the fact.
        const lotterySeed = generateLotterySeed()
        const lotteryOrder = deriveLotteryOrder(lotterySeed, rosterEmails)

        const updatedGroup = group.open(lotterySeed, lotteryOrder)

        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
