import { describe, expect, it } from 'vitest'
import { FirebaseGroupDocument, toGroupDocument, toGroupEntity } from './groupMapping'

// A group document as it looked before rotationPeriods existed. The
// submission-recording Firestore rule diffs the whole document against what's
// stored (see firestore.rules), so toGroupDocument(toGroupEntity(doc)) must
// reproduce a legacy doc key-for-key — an incidental new key would make an
// unrelated field look "changed" and the write would be rejected.
const legacyDoc: FirebaseGroupDocument = {
    id: 'group-1',
    name: 'Promo 2026',
    rotations: 2,
    status: 'draft',
    services: {},
    roster: [],
    rosterEmails: [],
    maxRejections: null,
    lotterySeed: null,
    lotteryOrder: null,
    submittedEmails: [],
    createdBy: 'user-1',
    createdByEmail: 'organizer@example.com',
    createdDate: '2026-01-01T00:00:00.000Z'
}

describe('groupMapping rotationPeriods round-trip', () => {
    it('omits rotationPeriods for a legacy document that never had the key', () => {
        const roundTripped = toGroupDocument(toGroupEntity(legacyDoc))

        // toEqual alone would treat a missing key and an explicit undefined
        // as the same thing, which is exactly the distinction that matters
        // for a Firestore diff-based security rule.
        expect(Object.keys(roundTripped).sort()).toEqual(Object.keys(legacyDoc).sort())
        expect(roundTripped).toEqual(legacyDoc)
    })

    it('preserves rotationPeriods for a document that has them set', () => {
        const docWithPeriods: FirebaseGroupDocument = {
            ...legacyDoc,
            rotationPeriods: [
                { startDate: '2026-09-01', endDate: '2026-09-30' },
                { startDate: null, endDate: null }
            ]
        }

        const roundTripped = toGroupDocument(toGroupEntity(docWithPeriods))

        expect(Object.keys(roundTripped).sort()).toEqual(Object.keys(docWithPeriods).sort())
        expect(roundTripped).toEqual(docWithPeriods)
    })
})
