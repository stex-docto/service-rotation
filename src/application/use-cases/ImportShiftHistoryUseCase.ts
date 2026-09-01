import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    VoteRepository
} from '@domain'
import { computeAssignment, InfeasibleError } from '@domain/matching'
import { SignInUseCase } from '@application'
import { buildMatchingInput } from '@application/matchingInputs'

export interface ImportShiftHistoryCommand {
    groupId: GroupId
}

export interface ImportShiftHistoryResult {
    group: GroupEntity
    // Current members still without a shiftHistory row after this run —
    // never a predecessor member, their predecessor vote wasn't locked, the
    // caller's own predecessor vote isn't locked (which makes every OTHER
    // predecessor vote unreadable too, see VoteRepository.findReadable), or
    // the predecessor has no computable result at all. Left absent rather
    // than written as zero, so the next run retries them instead of
    // freezing them at 0 forever — see Group.importPastShiftsFromPredecessor.
    stillMissingMemberIds: string[]
}

// Auto-fills shiftHistory for whichever current members don't have a row
// yet (see ShiftHistoryPanel's effect, driven by
// Group.importPastShiftsFromPredecessor) — never touches a uid that already
// has one. Presence in shiftHistory IS "has this member been set"; there is
// deliberately no separate provenance flag (manual edit, an accepted
// proposal, and a past run of this same use case are indistinguishable, by
// design — see Group.ts). Re-runnable and idempotent while the group is
// still a draft: a later run fills in anyone new (a member who just joined,
// or one who just became matchable now that the predecessor's result is
// computable) and never overwrites anyone already set. Requires no new read
// permission beyond what any member already has: this only works because
// ComputeResultUseCase-style computation is available to the caller under
// their own predecessor membership, never on another member's behalf.
export class ImportShiftHistoryUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: ImportShiftHistoryCommand): Promise<ImportShiftHistoryResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (!group.isCreator(user.id)) {
            throw new PermissionError('Only the group creator can import shift history')
        }
        if (!group.predecessorGroupId) {
            throw new Error('This group has no predecessor to import history from')
        }

        const missingMemberIds = group
            .getMembers()
            .map(member => member.userId.value)
            .filter(uid => !group.shiftHistory.has(uid))

        if (missingMemberIds.length === 0) {
            return { group, stillMissingMemberIds: [] }
        }

        const predecessor = await this.groupRepository.findById(group.predecessorGroupId)
        if (!predecessor) {
            throw new GroupNotFoundError()
        }

        // Per service NAME, not serviceId: a clone assigns every service a
        // fresh random id, so name is the only thing that survives from the
        // predecessor — same convention (and same same-name caveat) as
        // matchingInputs.ts's lottery seed.
        const countsByUidAndServiceName = new Map<string, Map<string, number>>()

        const predecessorMemberIds = predecessor.getMembers().map(member => member.userId.value)
        const predecessorVotes = await this.voteRepository.findReadable(
            predecessor.id,
            predecessorMemberIds
        )

        if (predecessorVotes.length > 0) {
            const serviceNameById = new Map(
                predecessor.getServices().map(service => [service.id.value, service.name])
            )
            try {
                const input = buildMatchingInput(predecessor, predecessorVotes)
                const computed = computeAssignment(input)
                for (const assignment of computed.assignments) {
                    const counts = new Map<string, number>()
                    for (const serviceId of assignment.rotationServiceIds) {
                        const name = serviceNameById.get(serviceId)
                        if (!name) continue
                        counts.set(name, (counts.get(name) ?? 0) + 1)
                    }
                    countsByUidAndServiceName.set(assignment.studentId, counts)
                }
            } catch (error) {
                if (!(error instanceof InfeasibleError)) {
                    throw error
                }
                // No computable result for the predecessor right now — every
                // still-missing member stays missing below, to retry on the
                // next run.
            }
        }

        const serviceIdByName = new Map(
            group.getServices().map(service => [service.name, service.id.value])
        )

        const history = new Map(group.shiftHistory)
        const stillMissingMemberIds: string[] = []
        let filledCount = 0
        for (const uid of missingMemberIds) {
            const byName = countsByUidAndServiceName.get(uid)
            if (!byName) {
                stillMissingMemberIds.push(uid)
                continue
            }
            const byServiceId = new Map<string, number>()
            for (const [name, count] of byName) {
                const serviceId = serviceIdByName.get(name)
                if (serviceId) {
                    byServiceId.set(serviceId, count)
                }
            }
            history.set(uid, byServiceId)
            filledCount++
        }

        if (filledCount === 0) {
            return { group, stillMissingMemberIds }
        }

        const updatedGroup = group.setShiftHistory(history)
        await this.groupRepository.save(updatedGroup)

        return { group: updatedGroup, stillMissingMemberIds }
    }
}
