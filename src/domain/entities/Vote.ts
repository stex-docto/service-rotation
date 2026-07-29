import { Grade, GroupId, ServiceId, UserId } from '@domain'

export interface Vote {
    groupId: GroupId
    userId: UserId
    grades: Map<string, Grade>
    locked: boolean
    // Set only once, by lock() — see firestore.rules, which enforces this
    // transition can only happen once per vote. Feeds the tie-break lottery
    // seed once every member's vote is readable — see lottery.ts.
    lockedAt: Date | null
}

// Freely editable while a draft (locked === false, own document only,
// nobody else can read it). lock() is a one-way transition — see
// firestore.rules — after which the vote is readable by any other member
// whose OWN vote is also locked, and never editable again.
export class VoteEntity implements Vote {
    constructor(
        public readonly groupId: GroupId,
        public readonly userId: UserId,
        public readonly grades: Map<string, Grade>,
        public readonly locked: boolean,
        public readonly lockedAt: Date | null
    ) {}

    static createDraft(groupId: GroupId, userId: UserId, grades: Map<string, Grade>): VoteEntity {
        return new VoteEntity(groupId, userId, new Map(grades), false, null)
    }

    updateGrades(grades: Map<string, Grade>): VoteEntity {
        if (this.locked) {
            throw new Error('This vote is locked and can no longer be edited')
        }

        return new VoteEntity(this.groupId, this.userId, new Map(grades), false, null)
    }

    lock(): VoteEntity {
        if (this.locked) {
            throw new Error('This vote is already locked')
        }

        return new VoteEntity(this.groupId, this.userId, this.grades, true, new Date())
    }

    gradeFor(serviceId: ServiceId): Grade | undefined {
        return this.grades.get(serviceId.value)
    }
}
