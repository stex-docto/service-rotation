import {
    Assignment,
    Email,
    GradeLevel,
    GroupId,
    ResultAlreadyExistsError,
    ResultEntity,
    ResultRepository,
    ServiceId
} from '@domain'
import { doc, Firestore, getDoc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'

type FirebaseAssignmentDocument = {
    email: string
    rotationServiceIds: string[]
}

type FirebaseResultDocument = {
    groupId: string
    assignments: FirebaseAssignmentDocument[]
    worstGradeLevel: GradeLevel
    totalCost: number
    theoreticalMinTotalCost: number
    seed: string
    computedAt: Timestamp
}

export class FirebaseResultDatastore implements ResultRepository {
    constructor(private readonly firestore: Firestore) {}

    private docRef(groupId: GroupId) {
        return doc(this.firestore, 'groups', groupId.value, 'result', 'final')
    }

    async save(result: ResultEntity): Promise<void> {
        const resultDoc: FirebaseResultDocument = {
            groupId: result.groupId.value,
            assignments: result.assignments.map(assignment => ({
                email: assignment.email.value,
                rotationServiceIds: assignment.rotationServiceIds.map(id => id.value)
            })),
            worstGradeLevel: result.worstGradeLevel,
            totalCost: result.totalCost,
            theoreticalMinTotalCost: result.theoreticalMinTotalCost,
            seed: result.seed,
            computedAt: Timestamp.fromDate(result.computedAt)
        }

        try {
            // Plain setDoc, not a merge: the result document is create-only
            // (firestore.rules: `allow update, delete: if false`), so writing
            // to an already-existing one is rejected as an update, not
            // silently accepted — that rejection IS the concurrent-compute
            // signal ComputeResultUseCase listens for.
            await setDoc(this.docRef(result.groupId), resultDoc)
        } catch (error) {
            if (isPermissionDenied(error)) {
                throw new ResultAlreadyExistsError()
            }
            throw error
        }
    }

    async findByGroup(groupId: GroupId): Promise<ResultEntity | null> {
        try {
            const snapshot = await getDoc(this.docRef(groupId))
            if (!snapshot.exists()) {
                return null
            }
            return this.mapToEntity(snapshot.data() as FirebaseResultDocument)
        } catch (_err) {
            return null
        }
    }

    subscribe(groupId: GroupId, callback: (result: ResultEntity | null) => void): () => void {
        return onSnapshot(
            this.docRef(groupId),
            snapshot => {
                if (!snapshot.exists()) {
                    callback(null)
                    return
                }
                try {
                    callback(this.mapToEntity(snapshot.data() as FirebaseResultDocument))
                } catch (error) {
                    console.error('Error mapping result data:', error)
                    callback(null)
                }
            },
            error => {
                console.error('Error in result subscription:', error)
                callback(null)
            }
        )
    }

    private mapToEntity(data: FirebaseResultDocument): ResultEntity {
        const assignments: Assignment[] = data.assignments.map(assignment => ({
            email: Email.from(assignment.email),
            rotationServiceIds: assignment.rotationServiceIds.map(id => ServiceId.from(id))
        }))

        return new ResultEntity(
            GroupId.from(data.groupId),
            assignments,
            data.worstGradeLevel,
            data.totalCost,
            data.theoreticalMinTotalCost,
            data.seed,
            data.computedAt.toDate()
        )
    }
}

function isPermissionDenied(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === 'permission-denied'
    )
}
