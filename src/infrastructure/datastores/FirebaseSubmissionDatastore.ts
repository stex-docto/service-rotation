import {
    Email,
    Grade,
    GradeLevel,
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    SubmissionEntity,
    SubmissionMetadata,
    SubmissionRepository
} from '@domain'
import { Auth } from 'firebase/auth'
import {
    doc,
    FieldValue,
    Firestore,
    getDoc,
    getDocs,
    collection as firestoreCollection,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    where
} from 'firebase/firestore'
import { FirebaseGroupDocument, toGroupDocument, toGroupEntity } from './groupMapping'

// submittedAt is a FieldValue sentinel on write (serverTimestamp()) and a
// resolved Timestamp once read back — see loadSubmission below.
type FirebaseSubmissionMetadataDocument = {
    email: string
    submittedAt: Timestamp | FieldValue | null
    rejectedServiceIds: string[]
}

type FirebaseSubmissionGradesDocument = {
    grades: { [serviceId: string]: GradeLevel }
}

export class FirebaseSubmissionDatastore implements SubmissionRepository {
    constructor(
        private readonly firestore: Firestore,
        private readonly auth: Auth
    ) {}

    private groupDocRef(groupId: GroupId) {
        return doc(this.firestore, 'groups', groupId.value)
    }

    private metadataDocRef(groupId: GroupId, uid: string) {
        return doc(this.firestore, 'groups', groupId.value, 'submissions', uid)
    }

    private gradesDocRef(groupId: GroupId, uid: string) {
        return doc(this.firestore, 'groups', groupId.value, 'submissions', uid, 'grades', 'data')
    }

    private metadataCollection(groupId: GroupId) {
        return firestoreCollection(this.firestore, 'groups', groupId.value, 'submissions')
    }

    // Derives rejections from the grades map at write time — never accepted
    // as a separately-supplied value — so the public metadata document can
    // never drift from what was actually submitted. See SubmissionMetadata.
    private splitGrades(grades: Map<string, Grade>): {
        rejectedServiceIds: string[]
        acceptedGrades: { [serviceId: string]: GradeLevel }
    } {
        const rejectedServiceIds: string[] = []
        const acceptedGrades: { [serviceId: string]: GradeLevel } = {}
        for (const [serviceId, grade] of grades) {
            if (grade.isRejection) {
                rejectedServiceIds.push(serviceId)
            } else {
                acceptedGrades[serviceId] = grade.level
            }
        }
        return { rejectedServiceIds, acceptedGrades }
    }

    async submit(submission: SubmissionEntity): Promise<GroupEntity> {
        const uid = this.auth.currentUser?.uid
        if (!uid) {
            throw new Error('You must be signed in to submit')
        }

        const { rejectedServiceIds, acceptedGrades } = this.splitGrades(submission.grades)
        const groupRef = this.groupDocRef(submission.groupId)
        const metadataRef = this.metadataDocRef(submission.groupId, uid)
        const gradesRef = this.gradesDocRef(submission.groupId, uid)

        // A transaction, not a batch: two students can submit within
        // milliseconds of each other, both appending to the same
        // group.submittedEmails array. Firestore re-runs this function with
        // fresh data if the group document changed between the read and the
        // commit attempt, so the second submitter's write is always computed
        // against the true latest state rather than silently rejected.
        return runTransaction(this.firestore, async transaction => {
            const groupSnapshot = await transaction.get(groupRef)
            if (!groupSnapshot.exists()) {
                throw new GroupNotFoundError()
            }
            const currentGroup = toGroupEntity(groupSnapshot.data() as FirebaseGroupDocument)
            const updatedGroup = currentGroup.recordSubmission(submission.email)

            const metadataDoc: FirebaseSubmissionMetadataDocument = {
                email: submission.email.value,
                submittedAt: serverTimestamp(),
                rejectedServiceIds
            }
            const gradesDoc: FirebaseSubmissionGradesDocument = { grades: acceptedGrades }

            transaction.set(groupRef, toGroupDocument(updatedGroup))
            transaction.set(metadataRef, metadataDoc)
            transaction.set(gradesRef, gradesDoc)

            return updatedGroup
        })
    }

    async findByGroupAndEmail(groupId: GroupId, email: Email): Promise<SubmissionEntity | null> {
        try {
            const metadataQuery = query(
                this.metadataCollection(groupId),
                where('email', '==', email.value)
            )
            const snapshot = await getDocs(metadataQuery)
            if (snapshot.empty) {
                return null
            }
            const metadataDoc = snapshot.docs[0]
            return await this.loadSubmission(
                groupId,
                metadataDoc.id,
                metadataDoc.data() as FirebaseSubmissionMetadataDocument
            )
        } catch (_err) {
            return null
        }
    }

    async findAllByGroup(groupId: GroupId): Promise<SubmissionEntity[]> {
        const snapshot = await getDocs(this.metadataCollection(groupId))
        const submissions = await Promise.all(
            snapshot.docs.map(metadataDoc =>
                this.loadSubmission(
                    groupId,
                    metadataDoc.id,
                    metadataDoc.data() as FirebaseSubmissionMetadataDocument
                )
            )
        )
        return submissions.filter(
            (submission): submission is SubmissionEntity => submission !== null
        )
    }

    async findSubmissionMetadataByGroup(groupId: GroupId): Promise<SubmissionMetadata[]> {
        const snapshot = await getDocs(this.metadataCollection(groupId))
        return snapshot.docs.map(metadataDoc => {
            const data = metadataDoc.data() as FirebaseSubmissionMetadataDocument
            return { email: data.email, rejectedServiceIds: data.rejectedServiceIds }
        })
    }

    private async loadSubmission(
        groupId: GroupId,
        uid: string,
        metadata: FirebaseSubmissionMetadataDocument
    ): Promise<SubmissionEntity | null> {
        try {
            const gradesSnapshot = await getDoc(this.gradesDocRef(groupId, uid))
            const gradesData = gradesSnapshot.exists()
                ? (gradesSnapshot.data() as FirebaseSubmissionGradesDocument)
                : { grades: {} }

            const grades = new Map<string, Grade>()
            for (const serviceId of metadata.rejectedServiceIds) {
                grades.set(serviceId, Grade.from(GradeLevel.ARejeter))
            }
            for (const [serviceId, level] of Object.entries(gradesData.grades)) {
                grades.set(serviceId, Grade.from(level))
            }

            // Always a resolved Timestamp by the time it comes back from a
            // read — the FieldValue sentinel only exists transiently on the
            // client before the write commits (see the type above).
            const submittedAtValue = metadata.submittedAt as Timestamp | null
            const submittedAt = submittedAtValue ? submittedAtValue.toDate() : new Date()
            return new SubmissionEntity(groupId, Email.from(metadata.email), grades, submittedAt)
        } catch (_err) {
            // Grades not yet readable for this caller (group incomplete and
            // caller is neither the submitter nor the organizer) — expected,
            // not an error. Callers that only need rejectedServiceIds should
            // use findSubmissionMetadataByGroup instead, which never hits this.
            return null
        }
    }
}
