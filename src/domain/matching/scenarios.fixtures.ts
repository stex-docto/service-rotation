import { MatchingInput, ServiceCapacity } from './types'

// Named regression fixtures for computeAssignment: real vote tables, paired
// with the actual output at the time these were written and independently
// re-derived (bruteForceOracle.ts for rotations === 1, hand-verification in
// session notes for the 2-rotation cases — see scenarios.test.ts for how
// each `expected` block is checked). The point is not "what the code
// currently emits" but "what the code is supposed to emit" — if a future
// change to assign.ts/edgeColouring.ts flips one of these, that's a
// regression to investigate, not a snapshot to rubber-stamp. See CLAUDE.md's
// note on this module having already shipped two subtle bugs that produced
// plausible-looking output.
//
// Every scenario here sizes total capacityPerRotation to exactly match the
// student count — a real group's admin has no reason to configure more or
// fewer seats than their own cohort, so an exact fit (not generous slack) is
// the common case this file is meant to guard. Slack/generous-capacity
// instances are still covered, just by the random property test in
// assign.test.ts rather than by name here.
//
// Layering, from least to most fragile:
//   - worstCost / totalCost / theoreticalMinTotalCost: what the README
//     promises the algorithm optimises for. Pinned on every scenario.
//   - servicesByStudent: the *set* of services each student ends up with.
//     This is what membership/capacity guarantees; it says nothing about
//     which rotation slot a service lands in. Pinned on every feasible
//     scenario.
//   - exactRotationScheduleByStudent: the literal per-rotation order, which
//     is scheduleRotations' (edge-colouring) internal choice, not something
//     the domain spec promises. Pinned on exactly one scenario
//     (everyone-gets-a-reasonable-pick) as a deliberate canary for the
//     scheduling step — a benign refactor of its iteration order is allowed
//     to break that one scenario; it should never break the others.
function grades(serviceIds: string[], row: number[]): Map<string, number> {
    return new Map(serviceIds.map((id, i) => [id, row[i]]))
}

export interface ScenarioExpectation {
    worstCost: number
    totalCost: number
    theoreticalMinTotalCost: number
    servicesByStudent: Record<string, string[]>
    exactRotationScheduleByStudent?: Record<string, string[]>
}

export interface Scenario {
    name: string
    description: string
    input: MatchingInput
    expected: ScenarioExpectation
}

export const scenarios: Scenario[] = []

// The everyday case: six students, four services sized to exactly fit the
// cohort (capacities sum to 6, matching student count — see the module
// comment above), two rotations, distinct hand-picked preferences. This is
// also the one scenario where we lock the exact rotation schedule (see the
// module comment above) — a canary for edgeColouring, not a spec
// requirement.
{
    const services: ServiceCapacity[] = [
        { serviceId: 'Cardiology', capacityPerRotation: 2 },
        { serviceId: 'Neurology', capacityPerRotation: 2 },
        { serviceId: 'Pediatrics', capacityPerRotation: 1 },
        { serviceId: 'Emergency', capacityPerRotation: 1 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana', 'Erin', 'Frank']
    const table: Record<string, number[]> = {
        Alice: [0, 1, 2, 3],
        Bob: [1, 0, 3, 2],
        Carol: [2, 3, 0, 1],
        Dana: [3, 2, 1, 0],
        Erin: [0, 2, 1, 3],
        Frank: [1, 3, 0, 2]
    }
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: grades(svcIds, table[studentId])
    }))

    scenarios.push({
        name: 'everyone-gets-a-reasonable-pick',
        description:
            'Six students, four services sized to exactly fit the cohort (2+2+1+1), two ' +
            'rotations, mild preference differences — the everyday case, no artificial slack.',
        input: { rotations: 2, services, students, lotteryOrder },
        expected: {
            worstCost: 2,
            totalCost: 8,
            theoreticalMinTotalCost: 8,
            servicesByStudent: {
                Alice: ['Neurology', 'Cardiology'],
                Bob: ['Neurology', 'Cardiology'],
                Carol: ['Pediatrics', 'Emergency'],
                Dana: ['Emergency', 'Neurology'],
                Erin: ['Cardiology', 'Neurology'],
                Frank: ['Cardiology', 'Pediatrics']
            },
            exactRotationScheduleByStudent: {
                Alice: ['Neurology', 'Cardiology'],
                Bob: ['Neurology', 'Cardiology'],
                Carol: ['Pediatrics', 'Emergency'],
                Dana: ['Emergency', 'Neurology'],
                Erin: ['Cardiology', 'Neurology'],
                Frank: ['Cardiology', 'Pediatrics']
            }
        }
    })
}

// Everyone wants the same popular service, but capacity — sized to exactly
// fit the cohort, like every other scenario here — only fits two of the six.
// Checks that minimax spreads the disappointment across exactly as many
// students as capacity forces, rather than concentrating it. Cardiology and
// Neurology are deliberately NOT cost-tied (2 vs 3) for the four who miss
// out — an earlier version gave both the same cost, which left
// which-of-the-two-they-get genuinely undetermined (correct either way, but
// an unpinnable implementation detail, not a property of the algorithm).
{
    const services: ServiceCapacity[] = [
        { serviceId: 'Popular', capacityPerRotation: 2 },
        { serviceId: 'Cardiology', capacityPerRotation: 2 },
        { serviceId: 'Neurology', capacityPerRotation: 2 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana', 'Erin', 'Frank']
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: grades(svcIds, [0, 2, 3])
    }))

    scenarios.push({
        name: 'popular-service-contention',
        description:
            'Six students all rate "Popular" (capacity 2) as best (0), Cardiology next (2), and ' +
            'Neurology last (3) — only two get their favourite, and capacity-2 Cardiology can ' +
            'only absorb two of the remaining four, pushing the last two to Neurology (cost 3).',
        input: { rotations: 1, services, students, lotteryOrder },
        expected: {
            worstCost: 3,
            totalCost: 10,
            theoreticalMinTotalCost: 10,
            servicesByStudent: {
                Alice: ['Popular'],
                Bob: ['Popular'],
                Carol: ['Cardiology'],
                Dana: ['Cardiology'],
                Erin: ['Neurology'],
                Frank: ['Neurology']
            }
        }
    })
}

// Capacity exactly matches demand for everyone's shared first choice, second
// choice, and last resort — checks that the two students stuck with the
// worst service (cost 3) is the true minimum, not an artefact.
{
    const services: ServiceCapacity[] = [
        { serviceId: 'S1', capacityPerRotation: 2 },
        { serviceId: 'S2', capacityPerRotation: 2 },
        { serviceId: 'S3', capacityPerRotation: 2 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana', 'Erin', 'Frank']
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: grades(svcIds, [0, 1, 3])
    }))

    scenarios.push({
        name: 'tight-capacity',
        description:
            'Six students, three services at capacity 2 each (exactly enough), everyone ranks ' +
            'S1 > S2 > S3 identically — two students are unavoidably stuck with S3.',
        input: { rotations: 1, services, students, lotteryOrder },
        expected: {
            worstCost: 3,
            totalCost: 8,
            theoreticalMinTotalCost: 8,
            servicesByStudent: {
                Alice: ['S1'],
                Bob: ['S1'],
                Carol: ['S2'],
                Dana: ['S2'],
                Erin: ['S3'],
                Frank: ['S3']
            }
        }
    })
}

// Two camps with opposite preferences and enough capacity for both — checks
// that disagreement alone doesn't manufacture a fairness cost when there's
// no actual scarcity.
{
    const services: ServiceCapacity[] = [
        { serviceId: 'X', capacityPerRotation: 3 },
        { serviceId: 'Y', capacityPerRotation: 3 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana', 'Erin', 'Frank']
    const table: Record<string, number[]> = {
        Alice: [0, 3],
        Bob: [0, 3],
        Carol: [0, 3],
        Dana: [3, 0],
        Erin: [3, 0],
        Frank: [3, 0]
    }
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: grades(svcIds, table[studentId])
    }))

    scenarios.push({
        name: 'polarised-camps',
        description:
            'Six students: three love X and hate Y, three love Y and hate X. Capacity 3 each — ' +
            'every student gets their favourite, at zero cost.',
        input: { rotations: 1, services, students, lotteryOrder },
        expected: {
            worstCost: 0,
            totalCost: 0,
            theoreticalMinTotalCost: 0,
            servicesByStudent: {
                Alice: ['X'],
                Bob: ['X'],
                Carol: ['X'],
                Dana: ['Y'],
                Erin: ['Y'],
                Frank: ['Y']
            }
        }
    })
}

// The one scenario in this file where minimax fairness genuinely costs more
// total than the unconstrained optimum: pushing Alice from cost 3 down to
// cost 2 (Cardiology -> Pediatrics) forces Dana up from 0 to 2, for a net +1
// on the total. Found by scanning small random instances for a non-zero
// fairness price and transcribed here with readable names so the scenario
// is auditable — see bruteForceOracle.ts, which independently confirms both
// the minimax optimum (worst=2, total=5) and the unconstrained one (total=4).
{
    const services: ServiceCapacity[] = [
        { serviceId: 'Cardiology', capacityPerRotation: 2 },
        { serviceId: 'Neurology', capacityPerRotation: 1 },
        { serviceId: 'Pediatrics', capacityPerRotation: 1 },
        { serviceId: 'Emergency', capacityPerRotation: 1 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana', 'Erin']
    const table: Record<string, number[]> = {
        Alice: [3, 3, 2, 3],
        Bob: [3, 0, 3, 3],
        Carol: [0, 3, 2, 1],
        Dana: [2, 0, 0, 0],
        Erin: [3, 3, 3, 1]
    }
    const students = lotteryOrder.map(studentId => ({
        studentId,
        costs: grades(svcIds, table[studentId])
    }))

    scenarios.push({
        name: 'fairness-has-a-price',
        description:
            'Five students, four tight-capacity services. The minimax-fair solution (total 5) ' +
            'costs strictly more than the unconstrained optimum (total 4) — that +1 gap is the ' +
            'price of fairness.',
        input: { rotations: 1, services, students, lotteryOrder },
        expected: {
            worstCost: 2,
            totalCost: 5,
            theoreticalMinTotalCost: 4,
            servicesByStudent: {
                Alice: ['Pediatrics'],
                Bob: ['Neurology'],
                Carol: ['Cardiology'],
                Dana: ['Cardiology'],
                Erin: ['Emergency']
            }
        }
    })
}

// Every grade identical everywhere — the lottery order is the only possible
// tie-break. With exactly as many services as rotations, every student must
// visit both, so this mainly checks that a fully-tied instance resolves
// cleanly (no throw, correct totals) rather than pinning a meaningful
// assignment choice.
{
    const services: ServiceCapacity[] = [
        { serviceId: 'S1', capacityPerRotation: 2 },
        { serviceId: 'S2', capacityPerRotation: 2 }
    ]
    const svcIds = services.map(s => s.serviceId)
    const lotteryOrder = ['Alice', 'Bob', 'Carol', 'Dana']
    const students = lotteryOrder.map(studentId => ({ studentId, costs: grades(svcIds, [1, 1]) }))

    scenarios.push({
        name: 'uniform-indifference',
        description:
            'Four students, two services cap 2 each, two rotations, every grade = 1 — pure ' +
            'lottery-order tie-break, no real preference signal.',
        input: { rotations: 2, services, students, lotteryOrder },
        expected: {
            worstCost: 1,
            totalCost: 8,
            theoreticalMinTotalCost: 8,
            servicesByStudent: {
                Alice: ['S1', 'S2'],
                Bob: ['S1', 'S2'],
                Carol: ['S1', 'S2'],
                Dana: ['S1', 'S2']
            }
        }
    })
}
