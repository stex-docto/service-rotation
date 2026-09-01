import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    UserId
} from '@domain'
import { SignInUseCase } from '@application'

// A generous ceiling on a manually-entered count, not a precise bound: this
// data is organizer-owned and publicly auditable before voting opens (see
// README's honesty argument for why shift history isn't a member's own
// self-reported field like a grade), so this only guards against fat-finger
// input, not adversarial gaming.
export const MAX_MANUAL_SHIFT_HISTORY = 20

export interface SetMemberShiftHistoryCommand {
    groupId: GroupId
    userId: UserId
    // serviceId -> shifts already done, before this cycle. Every value must
    // be a non-negative integer no greater than MAX_MANUAL_SHIFT_HISTORY.
    counts: Map<string, number>
}

export interface SetMemberShiftHistoryResult {
    group: GroupEntity
}

export class SetMemberShiftHistoryUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: SetMemberShiftHistoryCommand): Promise<SetMemberShiftHistoryResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can edit shift history')
        }

        for (const count of command.counts.values()) {
            if (!Number.isInteger(count) || count < 0 || count > MAX_MANUAL_SHIFT_HISTORY) {
                throw new Error(
                    `Shift count must be a whole number between 0 and ${MAX_MANUAL_SHIFT_HISTORY}`
                )
            }
        }

        const updatedGroup = group.setMemberShiftHistory(command.userId, command.counts)
        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup }
    }
}
