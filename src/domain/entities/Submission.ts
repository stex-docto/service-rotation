import { Email, Grade, GroupId, ServiceId } from '@domain'

export interface Submission {
    groupId: GroupId
    email: Email
    grades: Map<string, Grade>
    submittedAt: Date
}

// Immutable and create-only by design (see firestore.rules): once an intern
// submits a grade sheet, "no modification possible" is a hard invariant, not a
// UI convention. There is deliberately no update/delete method here.
export class SubmissionEntity implements Submission {
    constructor(
        public readonly groupId: GroupId,
        public readonly email: Email,
        public readonly grades: Map<string, Grade>,
        public readonly submittedAt: Date
    ) {}

    static create(groupId: GroupId, email: Email, grades: Map<string, Grade>): SubmissionEntity {
        return new SubmissionEntity(groupId, email, new Map(grades), new Date())
    }

    gradeFor(serviceId: ServiceId): Grade | undefined {
        return this.grades.get(serviceId.value)
    }

    countRejections(): number {
        return Array.from(this.grades.values()).filter(grade => grade.isRejection).length
    }
}
