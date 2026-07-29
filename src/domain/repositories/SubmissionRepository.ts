import { Email, GroupEntity, GroupId, SubmissionEntity } from '@domain'

export interface SubmissionMetadata {
    email: string
    // Which services this submitter rejected — public/always-listable by
    // design (see firestore.rules): a rejection reveals a veto, never a
    // preference among accepted services, so it can safely stay visible
    // before the group is complete. This is what makes an accurate,
    // privacy-preserving feasibility preflight possible — see
    // buildPreflightMatchingInput and SubmitGradesUseCase.
    rejectedServiceIds: string[]
}

export interface SubmissionRepository {
    // Writes the submission AND records it on the group (see
    // GroupEntity.recordSubmission) as a single atomic operation, and returns
    // the updated group so callers can check allSubmitted() without an extra
    // read. Two students can submit within milliseconds of each other, both
    // racing to append to the same group.submittedEmails array — this must
    // read-modify-write the group against its LATEST state, not a snapshot
    // the caller already had, or the second writer's update is silently
    // computed against stale data and rejected. There is deliberately no
    // separate update/delete — see SubmissionEntity.
    submit(submission: SubmissionEntity): Promise<GroupEntity>

    findByGroupAndEmail(groupId: GroupId, email: Email): Promise<SubmissionEntity | null>

    // Only resolves entries whose grades this caller is permitted to read —
    // see firestore.rules. Callers other than the organizer or the compute
    // path should expect this to withhold grades until the group is complete.
    findAllByGroup(groupId: GroupId): Promise<SubmissionEntity[]>

    // Rejection sets only, for every submitter so far — always readable,
    // unlike findAllByGroup. Derived at write time from the submitted grades
    // (never a separately-editable field), so it can't drift from what was
    // actually submitted.
    findSubmissionMetadataByGroup(groupId: GroupId): Promise<SubmissionMetadata[]>
}
