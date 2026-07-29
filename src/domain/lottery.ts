// The tie-break lottery is no longer pre-committed by an organizer: it's
// derived from the votes themselves, once they're all immutable. Nobody can
// act on the resulting order — by the time anyone can compute it, their own
// vote must already be locked (see firestore.rules' mutual-lock read rule) —
// so a plain deterministic hash is enough; no cryptographic unpredictability
// is needed the way a pre-commitment scheme would require.

// Small deterministic string hash (djb2), returned as hex so it composes as
// an opaque digest rather than a numeric bucket. Not used anywhere
// security-sensitive — the votes it's derived from, not this function, are
// the source of truth — but see deriveLotterySeedFromVotes for why it's
// applied twice rather than once.
function djb2Hex(input: string): string {
    let hash = 5381
    for (let i = 0; i < input.length; i++) {
        hash = (hash * 33) ^ input.charCodeAt(i)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
}

// A pure function of WHO voted and WHAT they voted — deliberately not of
// when. Two different groups with the same members casting the same grades
// produce the identical seed (and so the identical lottery order and
// assignment): the result depends only on the votes, nothing incidental like
// submission timing or which group happened to contain them.
//
// `serviceKey` must be something STABLE and comparable across separate group
// instances — a service's name, not its ServiceId. ServiceId is a
// crypto.randomUUID() minted fresh every time a service is created (see
// EntityId.generateId), so two groups with identically-named services would
// otherwise hash to unrelated ids and defeat the "same people, same votes,
// same output" property entirely. Two services sharing the same name within
// one group would collide here — harmless to the lottery's validity (it's
// still a fair shuffle), just not perfectly reproducible in that edge case.
//
// Hashed once per vote, THEN sorted and hashed again — not sorted by raw uid
// and concatenated in the clear. That means the returned seed (surfaced to
// users as ResultEntity.seed, for "recompute and verify" auditing) never
// embeds anyone's uid or grades in reconstructible form: it's an opaque
// digest of digests. Sharing or displaying it can't leak preferences to
// someone who never had legitimate read access to the votes themselves.
export function deriveLotterySeedFromVotes(
    votes: { id: string; grades: Map<string, number> }[]
): string {
    const perVoteDigests = votes.map(vote => {
        const gradeEntries = [...vote.grades.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([serviceKey, level]) => `${serviceKey}=${level}`)
            .join(',')
        return djb2Hex(`${vote.id}:${gradeEntries}`)
    })
    return djb2Hex([...perVoteDigests].sort().join('|'))
}

function mulberry32(seed: number): () => number {
    let state = seed
    return function next(): number {
        state |= 0
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function deriveLotteryOrder(seed: string, ids: string[]): string[] {
    const random = mulberry32(parseInt(djb2Hex(seed), 16))
    // Sort first: the shuffle is order-sensitive, and callers may hand this
    // function ids in whatever order a Map or Firestore document happened to
    // reconstruct them in. Without a canonical starting order, "anyone can
    // re-derive the same lottery order from the same votes" would silently
    // stop being true.
    const shuffled = [...ids].sort()
    // Fisher-Yates, deterministic given `random`.
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
    }
    return shuffled
}
