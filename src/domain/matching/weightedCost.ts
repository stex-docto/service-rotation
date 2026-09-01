// Turns a grade cost into the cost the matching engine actually optimises
// against, once past-shift history is in play. The engine itself
// (assign.ts) imposes no fixed cost scale — see costBoundsFor's comment
// there — so widening the range fed to it is already inside its contract;
// nothing in assign.ts/minCostFlow.ts/edgeColouring.ts needs to change for
// this. Only the caller building StudentGrades.costs (matchingInputs.ts)
// needs to know this function exists.

// One point of extra cost per shift already done, uncapped beyond
// `rotations` itself — the same natural bound already used elsewhere (see
// assign.ts's perStudentServiceCap). A named constant, not a magic number
// inline, because it's the one knob most likely to need tuning after real
// use: it controls how many grade levels of preference one prior shift is
// worth overriding.
export const PAST_SHIFT_PENALTY_PER_UNIT = 1

// gradeCost and shiftsAlreadyDone must both already be resolved, defaulted
// numbers — this function does not itself default a missing/undefined
// count to 0. A caller that forgets to default a missing history entry
// before calling this produces NaN here, which then silently poisons every
// comparison inside the min-cost flow without throwing (see
// matchingInputs.ts, which defaults with `?? 0` at the read site, not here).
export function computeWeightedCost(
    gradeCost: number,
    shiftsAlreadyDone: number,
    rotations: number
): number {
    const cappedShifts = Math.min(Math.max(shiftsAlreadyDone, 0), rotations)
    return gradeCost + PAST_SHIFT_PENALTY_PER_UNIT * cappedShifts
}
