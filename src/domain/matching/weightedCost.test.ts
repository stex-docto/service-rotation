import { describe, expect, it } from 'vitest'
import { computeWeightedCost, PAST_SHIFT_PENALTY_PER_UNIT } from './weightedCost'

// Deterministic PRNG (mulberry32) — see assign.test.ts for why this is
// duplicated per file rather than shared.
function mulberry32(seed: number) {
    let state = seed
    return function next(): number {
        state |= 0
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

describe('computeWeightedCost', () => {
    it('returns the grade cost unchanged when no shifts have been done', () => {
        expect(computeWeightedCost(0, 0, 4)).toBe(0)
        expect(computeWeightedCost(3, 0, 4)).toBe(3)
    })

    it('adds one PAST_SHIFT_PENALTY_PER_UNIT per shift, up to the cap', () => {
        expect(computeWeightedCost(0, 1, 4)).toBe(0 + 1 * PAST_SHIFT_PENALTY_PER_UNIT)
        expect(computeWeightedCost(0, 3, 4)).toBe(0 + 3 * PAST_SHIFT_PENALTY_PER_UNIT)
    })

    it('caps the penalty at `rotations`, never counting shifts beyond it', () => {
        const atCap = computeWeightedCost(0, 4, 4)
        const overCap = computeWeightedCost(0, 100, 4)
        expect(overCap).toBe(atCap)
        expect(atCap).toBe(4 * PAST_SHIFT_PENALTY_PER_UNIT)
    })

    it('can cross a grade tier: one prior shift ties an Excellent(0) service with a fresh Bien(1)', () => {
        const excellentWithOneShift = computeWeightedCost(0, 1, 4)
        const freshBien = computeWeightedCost(1, 0, 4)
        expect(excellentWithOneShift).toBe(freshBien)
    })

    it('can make a heavily-repeated Excellent(0) worse than a fresh Passable(3)', () => {
        const excellentWithManyShifts = computeWeightedCost(0, 4, 4)
        const freshPassable = computeWeightedCost(3, 0, 4)
        expect(excellentWithManyShifts).toBeGreaterThan(freshPassable)
    })

    // The failure mode this guards against: a caller that forwards an
    // undefined/missing history entry instead of defaulting it to 0 first
    // (see matchingInputs.ts) produces NaN here, which then poisons every
    // downstream min-cost-flow comparison without ever throwing. This test
    // doesn't call computeWeightedCost with undefined — TypeScript already
    // rules that out at the call site — it documents the contract instead:
    // every real (defaulted) input in range must yield a finite integer.
    it('never produces a non-finite or non-integer cost across random valid inputs', () => {
        const rng = mulberry32(42)
        for (let trial = 0; trial < 500; trial++) {
            const gradeCost = Math.floor(rng() * 4) // 0..3, mirrors GradeLevel's range
            const rotations = 1 + Math.floor(rng() * 8)
            const shiftsAlreadyDone = Math.floor(rng() * 20)

            const cost = computeWeightedCost(gradeCost, shiftsAlreadyDone, rotations)

            expect(Number.isFinite(cost)).toBe(true)
            expect(Number.isInteger(cost)).toBe(true)
            expect(cost).toBeGreaterThanOrEqual(gradeCost)
            expect(cost).toBeLessThanOrEqual(gradeCost + rotations * PAST_SHIFT_PENALTY_PER_UNIT)
        }
    })

    it('never goes below the grade cost, even for a negative shift count', () => {
        // Defensive only — SetMemberShiftHistoryUseCase already rejects a
        // negative count before it ever reaches storage.
        expect(computeWeightedCost(2, -5, 4)).toBe(2)
    })
})
