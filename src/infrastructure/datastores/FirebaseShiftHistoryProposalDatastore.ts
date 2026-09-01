import {
    GroupId,
    ShiftHistoryProposalEntity,
    ShiftHistoryProposalRepository,
    ShiftHistoryProposalStatus,
    UserId
} from '@domain'
import { doc, Firestore, getDoc, setDoc } from 'firebase/firestore'

type FirebaseShiftHistoryProposalDocument = {
    counts: { [serviceId: string]: number }
    justification: string | null
    status: ShiftHistoryProposalStatus
}

export class FirebaseShiftHistoryProposalDatastore implements ShiftHistoryProposalRepository {
    constructor(private readonly firestore: Firestore) {}

    private proposalRef(groupId: GroupId, userId: string) {
        return doc(this.firestore, 'groups', groupId.value, 'shiftHistoryProposals', userId)
    }

    async save(proposal: ShiftHistoryProposalEntity): Promise<void> {
        const proposalDoc: FirebaseShiftHistoryProposalDocument = {
            counts: Object.fromEntries(proposal.counts),
            justification: proposal.justification,
            status: proposal.status
        }
        await setDoc(this.proposalRef(proposal.groupId, proposal.userId.value), proposalDoc)
    }

    async findFor(groupId: GroupId, userId: UserId): Promise<ShiftHistoryProposalEntity | null> {
        try {
            const snapshot = await getDoc(this.proposalRef(groupId, userId.value))
            if (!snapshot.exists()) {
                return null
            }
            return this.toEntity(
                groupId,
                userId,
                snapshot.data() as FirebaseShiftHistoryProposalDocument
            )
        } catch (_err) {
            return null
        }
    }

    async findAll(
        groupId: GroupId,
        memberUserIds: string[]
    ): Promise<ShiftHistoryProposalEntity[]> {
        const results = await Promise.all(
            memberUserIds.map(async userId => {
                try {
                    const snapshot = await getDoc(this.proposalRef(groupId, userId))
                    if (!snapshot.exists()) {
                        return null
                    }
                    const data = snapshot.data() as FirebaseShiftHistoryProposalDocument
                    return this.toEntity(groupId, UserId.from(userId), data)
                } catch (_err) {
                    return null
                }
            })
        )
        return results.filter(
            (proposal): proposal is ShiftHistoryProposalEntity => proposal !== null
        )
    }

    private toEntity(
        groupId: GroupId,
        userId: UserId,
        data: FirebaseShiftHistoryProposalDocument
    ): ShiftHistoryProposalEntity {
        return new ShiftHistoryProposalEntity(
            groupId,
            userId,
            new Map(Object.entries(data.counts)),
            data.justification,
            data.status
        )
    }
}
