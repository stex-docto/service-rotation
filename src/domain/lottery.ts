// The tie-break lottery: generated once, before submissions open, and stored
// immutably on the group (see GroupEntity.open and firestore.rules). Anyone
// can re-derive `lotteryOrder` from `lotterySeed` alone, which is what makes
// the eventual computation independently verifiable rather than a black box.

export function generateLotterySeed(): string {
    return crypto.randomUUID()
}

// Small deterministic string hash (djb2) feeding a mulberry32 PRNG — good
// enough for a tie-break shuffle; not used anywhere security-sensitive since
// the seed itself, not this function, is the secret-free source of truth.
function seedToInt(seed: string): number {
    let hash = 5381
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 33) ^ seed.charCodeAt(i)
    }
    return hash >>> 0
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

export function deriveLotteryOrder(seed: string, emails: string[]): string[] {
    const random = mulberry32(seedToInt(seed))
    // Sort first: the shuffle is order-sensitive, and callers may hand this
    // function emails in whatever order a Map or Firestore document happened
    // to reconstruct them in. Without a canonical starting order, "anyone can
    // re-derive lotteryOrder from lotterySeed alone" would silently stop
    // being true.
    const shuffled = [...emails].sort()
    // Fisher-Yates, deterministic given `random`.
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
    }
    return shuffled
}
