import { GroupEntity, SubmissionEntity } from '@domain'
import type { MatchingInput } from '@domain/matching'

function servicesFor(group: GroupEntity) {
    return group.getServices().map(service => ({
        serviceId: service.id.value,
        capacityPerRotation: service.capacity
    }))
}

function requireLotteryOrder(group: GroupEntity): string[] {
    if (!group.lotteryOrder) {
        throw new Error('Cannot build a matching input before the group has been opened')
    }
    return group.lotteryOrder
}

// Full matching input from REAL submitted grades. Only meaningful once every
// roster member has actually submitted (or the organizer forces an early
// close) — that is exactly when firestore.rules make full grades readable, so
// this should never be called speculatively.
export function buildMatchingInput(
    group: GroupEntity,
    submissions: SubmissionEntity[]
): MatchingInput {
    const lotteryOrder = requireLotteryOrder(group)
    const services = servicesFor(group)
    const submissionByEmail = new Map(
        submissions.map(submission => [submission.email.value, submission])
    )

    const students = lotteryOrder.map(email => {
        const submission = submissionByEmail.get(email)
        if (!submission) {
            // A straggler under an organizer-forced early close: treated as
            // indifferent, nothing rejected.
            return {
                studentId: email,
                costs: new Map(services.map(service => [service.serviceId, 0]))
            }
        }

        const costs = new Map<string, number>()
        for (const service of group.getServices()) {
            const grade = submission.gradeFor(service.id)
            if (grade && !grade.isRejection) {
                costs.set(service.id.value, grade.cost)
            }
        }
        return { studentId: email, costs }
    })

    return { rotations: group.rotations, services, students, lotteryOrder }
}

// Rejection-only preflight input: uses each already-submitted student's REAL
// rejection set (public — see SubmissionMetadata), the candidate's own
// about-to-be-submitted rejections, and treats every other roster member
// (not yet submitted) as accepting everything. Feasibility depends only on
// which (student, service) edges exist, never on the 0..4 intensities among
// accepted services — see isAssignmentFeasible — so this is a fully accurate
// feasibility check without reading anyone's real preferences early.
export function buildPreflightMatchingInput(
    group: GroupEntity,
    rejectionsByEmail: Map<string, Set<string>>,
    candidateEmail: string,
    candidateRejectedServiceIds: Set<string>
): MatchingInput {
    const lotteryOrder = requireLotteryOrder(group)
    const services = servicesFor(group)

    const students = lotteryOrder.map(email => {
        const rejected =
            email === candidateEmail
                ? candidateRejectedServiceIds
                : (rejectionsByEmail.get(email) ?? new Set<string>())

        const costs = new Map<string, number>()
        for (const service of services) {
            if (!rejected.has(service.serviceId)) {
                costs.set(service.serviceId, 0) // intensity is irrelevant to feasibility
            }
        }
        return { studentId: email, costs }
    })

    return { rotations: group.rotations, services, students, lotteryOrder }
}
