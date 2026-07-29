import {
    Grade,
    GradeLevel,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    SubmissionEntity,
    SubmissionRepository
} from '@domain'
import { isAssignmentFeasible } from '@domain/matching'
import { SignInUseCase } from '@application'
import { buildPreflightMatchingInput } from '@application/matchingInputs'
import { ComputeResultUseCase } from '@application/use-cases/ComputeResultUseCase'

export interface SubmitGradesCommand {
    groupId: GroupId
    grades: Map<string, GradeLevel> // keyed by serviceId
}

export interface SubmitGradesResult {
    submission: SubmissionEntity
}

export class SubmitGradesUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly submissionRepository: SubmissionRepository,
        private readonly signInUseCase: SignInUseCase,
        private readonly computeResultUseCase: ComputeResultUseCase
    ) {}

    async execute(command: SubmitGradesCommand): Promise<SubmitGradesResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }
        if (group.status !== 'open') {
            throw new Error('This group is not currently accepting submissions')
        }
        if (!group.roster.has(user.email)) {
            throw new Error("You are not on this group's roster")
        }
        if (group.hasSubmitted(user.email)) {
            throw new Error('You have already submitted your grades')
        }

        // Every service must be graded — exactly once, nothing extra. A
        // missing key would silently become a rejection (see Grade); an
        // unknown key is almost certainly a stale form.
        const serviceIds = new Set(group.getServices().map(service => service.id.value))
        if (
            command.grades.size !== serviceIds.size ||
            [...serviceIds].some(id => !command.grades.has(id))
        ) {
            throw new Error('Every service must be graded exactly once')
        }

        const grades = new Map(
            Array.from(command.grades, ([serviceId, level]) => [serviceId, Grade.from(level)])
        )
        const rejectedServiceIds = new Set(
            Array.from(grades, ([serviceId, grade]) =>
                grade.isRejection ? serviceId : null
            ).filter((id): id is string => id !== null)
        )
        const maxRejections = group.maxRejections ?? 0
        if (rejectedServiceIds.size > maxRejections) {
            throw new Error(
                `You rejected ${rejectedServiceIds.size} services, but this group allows at most ${maxRejections}.`
            )
        }

        // Preflight: would this submission, combined with everyone else's
        // REAL rejections so far and full leniency from stragglers, still
        // leave a schedulable assignment? Uses only rejection sets (public),
        // never preference intensities — see buildPreflightMatchingInput.
        // This is what keeps "no recovery path once the roster is frozen"
        // from ever becoming a real dead end.
        const metadata = await this.submissionRepository.findSubmissionMetadataByGroup(
            command.groupId
        )
        const rejectionsByEmail = new Map(
            metadata.map(entry => [entry.email, new Set(entry.rejectedServiceIds)])
        )
        const preflightInput = buildPreflightMatchingInput(
            group,
            rejectionsByEmail,
            user.email.value,
            rejectedServiceIds
        )
        if (!isAssignmentFeasible(preflightInput)) {
            throw new Error(
                'These rejections leave no schedulable assignment given what has been submitted so far. ' +
                    'Reject fewer services and try again.'
            )
        }

        const submission = SubmissionEntity.create(command.groupId, user.email, grades)

        // submit() reads-modifies-writes the group transactionally, against
        // its LATEST state rather than the (possibly now-stale) `group`
        // fetched above — see SubmissionRepository.submit for why that
        // matters when two people submit close together.
        const updatedGroup = await this.submissionRepository.submit(submission)

        if (updatedGroup.allSubmitted()) {
            // Whoever's browser observes the last submission computes the
            // result — see the plan. A failure here doesn't undo the
            // submission; the next person to open the group retries it (see
            // ComputeResultUseCase / GetGroupUseCase).
            try {
                await this.computeResultUseCase.execute({ groupId: command.groupId })
            } catch {
                // Intentionally swallowed — recovery happens on next load.
            }
        }

        return { submission }
    }
}
