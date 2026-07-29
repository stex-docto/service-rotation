import { scheduleRotations } from './edgeColouring'
import { FlowNetwork } from './minCostFlow'
import {
    InfeasibleError,
    MatchingInput,
    MatchingResult,
    ServiceCapacity,
    StudentAssignment
} from './types'

// Must dominate any lottery-rank tie-break contribution to the total, so
// grade cost always decides the primary objective and rank only ever breaks
// true ties. A single edge's rank term is at most (n-1); a full assignment
// carries at most `rotations` such terms per student across all n students,
// so the worst-case spread between two equal-real-cost solutions is bounded
// by rotations * n. `rotations * n + 1` always exceeds that, at any scale —
// computed per call rather than a fixed constant so it can never silently
// stop dominating as n grows. See the "Determinism" section of the plan: the
// lottery order is committed before submissions open, so this tie-break is
// exactly as auditable as the grades themselves.
function tieBreakScaleFor(input: MatchingInput): number {
    return input.lotteryOrder.length * input.rotations + 1
}

// The engine imposes no fixed cost scale of its own — it derives the
// acceptable range from whatever integer costs this specific input actually
// contains, rather than assuming a hardcoded 0..3. That range only needs to
// be correct for THIS input: feasibleAt/the binary search below only ever
// compare against values inside it. (The current application layer always
// populates costs from Grade's 0..3 scale — see ComputeResultUseCase's
// worstCost -> GradeLevel cast — but that's a convention of the caller, not
// a constraint enforced here.) Costs are still assumed to be integers: the
// binary search's `mid + 1` step relies on adjacent thresholds differing by
// exactly 1, same as before this was made dynamic.
function costBoundsFor(input: MatchingInput): { min: number; max: number } {
    let min = Infinity
    let max = -Infinity
    for (const student of input.students) {
        for (const cost of student.costs.values()) {
            if (cost < min) min = cost
            if (cost > max) max = cost
        }
    }
    // No costs anywhere (e.g. no students, or nobody has a single grade) —
    // feasibleAt will correctly report infeasible regardless of this choice.
    if (min === Infinity) return { min: 0, max: 0 }
    return { min, max }
}

interface EdgeMeta {
    studentId: string
    serviceId: string
    realCost: number
    callIndex: number
}

interface Network {
    graph: FlowNetwork
    source: number
    sink: number
    edges: EdgeMeta[]
}

function buildNetwork(
    input: MatchingInput,
    orderedServices: ServiceCapacity[],
    rankOf: Map<string, number>,
    costLimit: number,
    tieBreakScale: number
): Network {
    const n = input.lotteryOrder.length
    const m = orderedServices.length
    const source = 0
    const sink = n + m + 1
    const studentNode = (i: number) => 1 + i
    const serviceNode = (j: number) => 1 + n + j

    const graph = new FlowNetwork(sink + 1)
    const gradesByStudent = new Map(input.students.map(s => [s.studentId, s.costs]))
    const edges: EdgeMeta[] = []
    let callIndex = 0

    input.lotteryOrder.forEach((studentId, i) => {
        graph.addEdge(source, studentNode(i), input.rotations, 0)
        callIndex++ // source->student edges also consume a call slot

        const costs = gradesByStudent.get(studentId)
        orderedServices.forEach((service, j) => {
            const realCost = costs?.get(service.serviceId)
            if (realCost === undefined || realCost > costLimit) return

            const perturbedCost = realCost * tieBreakScale + (rankOf.get(studentId) as number)
            graph.addEdge(studentNode(i), serviceNode(j), 1, perturbedCost)
            edges.push({ studentId, serviceId: service.serviceId, realCost, callIndex })
            callIndex++
        })
    })

    orderedServices.forEach((service, j) => {
        graph.addEdge(serviceNode(j), sink, input.rotations * service.capacityPerRotation, 0)
        callIndex++
    })

    return { graph, source, sink, edges }
}

function extractAssignment(
    network: Network,
    targetFlow: number
): {
    assignment: Map<string, string[]>
    totalCost: number
    worstCost: number
} {
    const { flow } = network.graph.minCostFlow(network.source, network.sink, targetFlow)
    if (flow !== targetFlow) {
        throw new Error(
            'Internal invariant violated: expected flow saturated after a feasible probe'
        )
    }

    const assignment = new Map<string, string[]>()
    let totalCost = 0
    // -Infinity, not a hardcoded floor: targetFlow > 0 guarantees at least
    // one edge below is actually assigned, so the real Math.max always wins
    // on the first iteration regardless of the cost scale's sign.
    let worstCost = -Infinity

    for (const edge of network.edges) {
        if (network.graph.flowOnEdgeAt(edge.callIndex) !== 1) continue
        const list = assignment.get(edge.studentId) ?? []
        list.push(edge.serviceId)
        assignment.set(edge.studentId, list)
        totalCost += edge.realCost
        worstCost = Math.max(worstCost, edge.realCost)
    }

    return { assignment, totalCost, worstCost }
}

// The full mechanism: minimax on the worst grade received, then minimise the
// total under that cap, then schedule the chosen services into rotations.
// See the plan's "Mechanism" section for the reasoning behind each step.
export function computeAssignment(input: MatchingInput): MatchingResult {
    const n = input.lotteryOrder.length
    const targetFlow = n * input.rotations
    const rankOf = new Map(input.lotteryOrder.map((id, index) => [id, index]))
    const orderedServices = [...input.services].sort((a, b) =>
        a.serviceId.localeCompare(b.serviceId)
    )
    const tieBreakScale = tieBreakScaleFor(input)
    const { min: minCost, max: maxCost } = costBoundsFor(input)

    const feasibleAt = (costLimit: number): boolean => {
        const network = buildNetwork(input, orderedServices, rankOf, costLimit, tieBreakScale)
        const { flow } = network.graph.minCostFlow(network.source, network.sink, targetFlow)
        return flow === targetFlow
    }

    if (!feasibleAt(maxCost)) {
        throw new InfeasibleError(
            'No assignment exists that gives every student their required number of distinct services. ' +
                'Increase capacity or add services.'
        )
    }

    // Binary search the minimal achievable worst-case grade, between the
    // cheapest and priciest cost actually present in this input.
    let low = minCost
    let high = maxCost
    while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (feasibleAt(mid)) {
            high = mid
        } else {
            low = mid + 1
        }
    }
    const worstCostThreshold = low

    const fairNetwork = buildNetwork(
        input,
        orderedServices,
        rankOf,
        worstCostThreshold,
        tieBreakScale
    )
    const fair = extractAssignment(fairNetwork, targetFlow)

    const unconstrainedNetwork = buildNetwork(
        input,
        orderedServices,
        rankOf,
        maxCost,
        tieBreakScale
    )
    const unconstrained = extractAssignment(unconstrainedNetwork, targetFlow)

    const schedule = scheduleRotations(
        fair.assignment,
        input.services,
        input.rotations,
        input.lotteryOrder
    )

    const assignments: StudentAssignment[] = input.lotteryOrder.map(studentId => ({
        studentId,
        rotationServiceIds: schedule.get(studentId) as string[]
    }))

    return {
        assignments,
        worstCost: fair.worstCost,
        totalCost: fair.totalCost,
        theoreticalMinTotalCost: unconstrained.totalCost
    }
}

// Structural feasibility check, independent of any votes: whether there are
// even enough distinct services to fill every rotation. Grade-driven
// infeasibility (not enough capacity for how many members actually voted) is
// instead discovered by computeAssignment itself, at compute time, over
// whoever's votes are readable then — there is no fixed roster to check this
// against upfront any more, since membership is open until the owner closes
// the invite.
export function checkStructuralFeasibility(
    services: ServiceCapacity[],
    rotations: number
): { feasible: boolean; reason?: string } {
    if (services.length < rotations) {
        return { feasible: false, reason: 'There must be at least as many services as rotations.' }
    }
    return { feasible: true }
}
