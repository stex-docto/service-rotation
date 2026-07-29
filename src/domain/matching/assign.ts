import { scheduleRotations } from './edgeColouring'
import { FlowNetwork } from './minCostFlow'
import {
    InfeasibleError,
    MAX_ACCEPTABLE_COST,
    MIN_ACCEPTABLE_COST,
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
    let worstCost = MIN_ACCEPTABLE_COST

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

    const feasibleAt = (costLimit: number): boolean => {
        const network = buildNetwork(input, orderedServices, rankOf, costLimit, tieBreakScale)
        const { flow } = network.graph.minCostFlow(network.source, network.sink, targetFlow)
        return flow === targetFlow
    }

    if (!feasibleAt(MAX_ACCEPTABLE_COST)) {
        throw new InfeasibleError(
            'No assignment exists that gives every student their required number of distinct, non-rejected services. ' +
                'Increase capacity, add services, or lower the rejection cap.'
        )
    }

    // Binary search the minimal achievable worst-case grade. At most 3 probes
    // over the 5 acceptable levels (0..4).
    let low = MIN_ACCEPTABLE_COST
    let high = MAX_ACCEPTABLE_COST
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
        MAX_ACCEPTABLE_COST,
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

// Feasibility only — no minimax search, no phase 2 scheduling. Used by
// SubmitGradesUseCase's preflight check, which runs on every submission and
// only needs a yes/no answer, not the assignment itself.
export function isAssignmentFeasible(input: MatchingInput): boolean {
    const n = input.lotteryOrder.length
    const targetFlow = n * input.rotations
    const rankOf = new Map(input.lotteryOrder.map((id, index) => [id, index]))
    const orderedServices = [...input.services].sort((a, b) =>
        a.serviceId.localeCompare(b.serviceId)
    )
    const tieBreakScale = tieBreakScaleFor(input)

    const network = buildNetwork(input, orderedServices, rankOf, MAX_ACCEPTABLE_COST, tieBreakScale)
    const { flow } = network.graph.minCostFlow(network.source, network.sink, targetFlow)
    return flow === targetFlow
}

// Structural feasibility check for OpenSubmissionsUseCase, run BEFORE any
// grades exist. Uses a fully indifferent placeholder (every service costs 0,
// nothing rejected) so it only catches capacity/scheduling infeasibility —
// e.g. enough total capacity but badly distributed across services, which
// simple arithmetic ("total capacity >= roster size") misses entirely. It
// cannot anticipate real rejections submitted later; that is a deliberate,
// documented limitation, not an oversight.
export function checkStructuralFeasibility(
    services: ServiceCapacity[],
    rotations: number,
    rosterEmails: string[]
): { feasible: boolean; reason?: string } {
    if (services.length < rotations) {
        return { feasible: false, reason: 'There must be at least as many services as rotations.' }
    }

    const placeholderInput: MatchingInput = {
        rotations,
        services,
        students: rosterEmails.map(email => ({
            studentId: email,
            costs: new Map(services.map(service => [service.serviceId, 0]))
        })),
        lotteryOrder: rosterEmails
    }

    try {
        computeAssignment(placeholderInput)
        return { feasible: true }
    } catch (error) {
        if (error instanceof InfeasibleError) {
            return { feasible: false, reason: error.message }
        }
        throw error
    }
}
