import {
    GradeLevel,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    PermissionError,
    ResultAlreadyExistsError,
    ResultEntity,
    ResultRepository,
    SubmissionRepository
} from '@domain'
import { computeAssignment } from '@domain/matching'
import { SignInUseCase } from '@application'
import { buildMatchingInput } from '@application/matchingInputs'

export interface ComputeResultCommand {
    groupId: GroupId
    // Only the organizer may force a compute before the roster is complete
    // (stragglers are then treated as indifferent, nothing rejected). Without
    // this flag, the roster must already be fully submitted — this is both
    // the automatic post-submission path and the recovery path a viewer
    // triggers when they notice a complete group with no result yet.
    forcedByOrganizer?: boolean
}

export interface ComputeResultResult {
    result: ResultEntity
}

export class ComputeResultUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly submissionRepository: SubmissionRepository,
        private readonly resultRepository: ResultRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: ComputeResultCommand): Promise<ComputeResultResult> {
        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }

        // Idempotent: a group already marked computed just returns its
        // existing result, so callers (auto-trigger, recovery-on-load, a
        // stale organizer click) never need to guard against calling twice.
        if (group.status === 'computed') {
            const existing = await this.resultRepository.findByGroup(command.groupId)
            if (existing) {
                return { result: existing }
            }
        }

        if (!group.allSubmitted()) {
            if (!command.forcedByOrganizer) {
                throw new Error('Not every roster member has submitted yet')
            }
            const user = await this.signInUseCase.requireCurrentUser()
            if (!group.isCreator(user.id)) {
                throw new PermissionError('Only the group creator can close submissions early')
            }
        }

        const submissions = await this.submissionRepository.findAllByGroup(command.groupId)
        const input = buildMatchingInput(group, submissions)
        const computed = computeAssignment(input)

        const rosterByEmail = new Map(group.getRoster().map(entry => [entry.email.value, entry]))
        const servicesById = new Map(
            group.getServices().map(service => [service.id.value, service])
        )

        const assignments = computed.assignments.map(assignment => {
            const rosterEntry = rosterByEmail.get(assignment.studentId)
            if (!rosterEntry) {
                throw new Error(
                    `Internal invariant violated: assignment references unknown student ${assignment.studentId}`
                )
            }
            return {
                email: rosterEntry.email,
                rotationServiceIds: assignment.rotationServiceIds.map(serviceIdValue => {
                    const service = servicesById.get(serviceIdValue)
                    if (!service) {
                        throw new Error(
                            `Internal invariant violated: assignment references unknown service ${serviceIdValue}`
                        )
                    }
                    return service.id
                })
            }
        })

        const result = ResultEntity.create(
            command.groupId,
            assignments,
            // The matching engine's cost scale (0..4) is exactly Grade's
            // acceptable levels (Excellent..Insuffisant) by construction —
            // see MAX_ACCEPTABLE_COST — so this cast is safe.
            computed.worstCost as GradeLevel,
            computed.totalCost,
            computed.theoreticalMinTotalCost,
            group.lotterySeed as string
        )

        try {
            await this.resultRepository.save(result)
        } catch (error) {
            if (error instanceof ResultAlreadyExistsError) {
                // Another browser won the race — read back what it wrote
                // rather than surfacing an error; the submission that
                // triggered this call already succeeded regardless.
                const winner = await this.resultRepository.findByGroup(command.groupId)
                if (winner) {
                    return { result: winner }
                }
            }
            throw error
        }

        try {
            await this.groupRepository.save(group.markComputed())
        } catch {
            // Non-fatal: reads are gated on submittedEmails.size == roster
            // size, not on this status field, so grades and the result stay
            // visible either way — see firestore.rules.
        }

        return { result }
    }
}
