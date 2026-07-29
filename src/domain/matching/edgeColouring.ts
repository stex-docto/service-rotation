import { findPerfectMatching } from './bipartiteMatching'
import type { ServiceCapacity } from './types'

// Phase 2: schedule a fixed (student, service-set) assignment from phase 1
// into `rotations` distinct rounds, respecting per-rotation capacity.
//
// Phase 1 only constrains TOTAL capacity across all rotations (k * capacity_j
// per service). Turning that into a rotation-by-rotation schedule where every
// student visits each of their k chosen services exactly once, and no service
// exceeds its per-rotation capacity, is a bipartite edge-colouring problem:
//
//   - Split service j into "copies" (physical rooms), and round-robin its
//     d_j assigned students across them. We only ever need ceil(d_j / k)
//     copies — never the full capacity_j — since a copy can hold at most k
//     students (one per rotation) and phase 1 already guarantees
//     d_j <= k * capacity_j, i.e. ceil(d_j / k) <= capacity_j always. Using
//     the minimal copy count (rather than always capacity_j) keeps the
//     padding step below small and avoids manufacturing large numbers of
//     permanently-empty copies for generously-sized services.
//   - Every student has degree exactly k (their k chosen service visits —
//     usually distinct, but a service may repeat when phase 1 allowed it,
//     see assign.ts's allowRepeatedServices — each mapped to one specific
//     copy). Every copy has degree <= k.
//   - Pad the graph with dummy student nodes (never dummy copies — see the
//     note below) so it becomes EXACTLY k-regular, then repeatedly extract a
//     perfect matching and remove it. A perfect matching touches every node
//     exactly once, so it preserves exact regularity for the next round —
//     the standard constructive proof of Koenig's edge-colouring theorem.
//     Each extracted matching is one rotation.
//
//   Padding edges are allowed to repeat (a dummy student connected to the
//   same copy more than once, i.e. a bipartite MULTIgraph): Koenig's theorem
//   (chromatic index = max degree) holds for bipartite multigraphs just as
//   well as simple graphs, and dummy edges represent nothing real — a copy
//   being "used" by the same padding-dummy in two different rounds doesn't
//   violate anything, since real capacity is only ever touched by real
//   students. Insisting on simple (non-repeating) padding edges was an
//   unnecessary and, worse, occasionally UNSATISFIABLE self-constraint (a
//   dummy needing `k` distinct partners can fail to find that many when
//   deficiency happens to be concentrated in fewer than `k` copies) — allow
//   multiplicity instead of working around it.
//
// This is always possible once phase 1 succeeds — no backtracking, no risk
// of getting "stuck" partway through a rotation.
export function scheduleRotations(
    phase1Assignment: Map<string, string[]>,
    services: ServiceCapacity[],
    rotations: number,
    lotteryOrder: string[]
): Map<string, string[]> {
    const studentIndex = new Map(lotteryOrder.map((id, index) => [id, index]))
    const studentCount = lotteryOrder.length

    // Canonical, deterministic service order (independent of Map/object
    // iteration order) — everything downstream derives from this plus
    // lotteryOrder, so the whole pipeline is reproducible.
    const orderedServices = [...services].sort((a, b) => a.serviceId.localeCompare(b.serviceId))

    // assignedTo[serviceId] = studentIds assigned to it in phase 1, ordered by
    // lottery rank (ascending) so round-robin distribution is deterministic.
    const assignedTo = new Map<string, string[]>(
        orderedServices.map(service => [service.serviceId, []])
    )
    for (const [studentId, serviceIds] of phase1Assignment) {
        for (const serviceId of serviceIds) {
            assignedTo.get(serviceId)?.push(studentId)
        }
    }
    for (const list of assignedTo.values()) {
        list.sort((a, b) => (studentIndex.get(a) ?? 0) - (studentIndex.get(b) ?? 0))
    }

    // Lay out global copy indices using the MINIMAL copy count per service
    // (see the note above) — copies of the first service first, etc.
    // copyServiceId[c] = which service copy c belongs to.
    const copyServiceId: string[] = []
    const copyOffset = new Map<string, number>()
    const copiesUsedFor = new Map<string, number>()
    for (const service of orderedServices) {
        const demand = (assignedTo.get(service.serviceId) as string[]).length
        const copiesNeeded = Math.min(service.capacityPerRotation, Math.ceil(demand / rotations))
        copiesUsedFor.set(service.serviceId, copiesNeeded)
        copyOffset.set(service.serviceId, copyServiceId.length)
        for (let i = 0; i < copiesNeeded; i++) {
            copyServiceId.push(service.serviceId)
        }
    }
    const copyCount = copyServiceId.length

    // copyCount >= studentCount is guaranteed here: ceil(d_j / rotations)
    // summed over services is always >= (sum of d_j) / rotations, and
    // sum(d_j) = studentCount * rotations (every student contributes to
    // exactly `rotations` services), so the sum is always >= studentCount.
    // That is why padding below only ever needs dummy STUDENT nodes, never
    // dummy copies.
    if (copyCount < studentCount) {
        throw new Error('Internal invariant violated: fewer copies than students reached phase 2')
    }

    // Round-robin each service's assigned students across its (minimal) set
    // of copies, and record which global copy index each (student, service)
    // pair landed on.
    const studentCopyIndices = new Map<string, number[]>(lotteryOrder.map(id => [id, []]))
    const copyDegree = new Array(copyCount).fill(0)
    for (const service of orderedServices) {
        const students = assignedTo.get(service.serviceId) as string[]
        const offset = copyOffset.get(service.serviceId) as number
        const copiesNeeded = copiesUsedFor.get(service.serviceId) as number
        students.forEach((studentId, position) => {
            const copyIndex = offset + (position % copiesNeeded)
            studentCopyIndices.get(studentId)?.push(copyIndex)
            copyDegree[copyIndex] += 1
        })
    }

    // Adjacency is a multigraph: adjacency[left].get(copy) = edge multiplicity
    // (how many rounds this pairing can still be used for). Real student
    // edges are usually multiplicity 1, but can be higher when
    // allowRepeatedServices let a student land on the same copy more than
    // once — no different from dummy padding edges, which have always relied
    // on multiplicity > 1 (see the note above): Koenig's theorem doesn't care
    // whether an edge is real or padding.
    const dummyStudentCount = copyCount - studentCount
    const totalLeft = studentCount + dummyStudentCount
    const adjacency: Map<number, number>[] = Array.from({ length: totalLeft }, () => new Map())

    function addEdge(left: number, copy: number, count: number = 1): void {
        adjacency[left].set(copy, (adjacency[left].get(copy) ?? 0) + count)
    }

    for (const studentId of lotteryOrder) {
        const left = studentIndex.get(studentId) as number
        for (const copyIndex of studentCopyIndices.get(studentId) as number[]) {
            addEdge(left, copyIndex)
        }
    }

    // Pad every under-full copy up to degree `rotations` using dummy
    // students. Total left deficiency (dummy students, each needing exactly
    // `rotations` edges) and total right deficiency (under-full real copies)
    // are equal by construction, so a plain deterministic zip always pairs
    // them off exactly — repeats are fine (see above), so no bin-packing
    // cleverness is needed here.
    const leftDeficiencySlots: number[] = []
    for (let dummy = 0; dummy < dummyStudentCount; dummy++) {
        const left = studentCount + dummy
        for (let unit = 0; unit < rotations; unit++) leftDeficiencySlots.push(left)
    }
    const rightDeficiencySlots: number[] = []
    for (let copy = 0; copy < copyCount; copy++) {
        for (let unit = 0; unit < rotations - copyDegree[copy]; unit++)
            rightDeficiencySlots.push(copy)
    }
    if (leftDeficiencySlots.length !== rightDeficiencySlots.length) {
        throw new Error(
            'Internal invariant violated: padding deficiency mismatch between students and copies'
        )
    }
    for (let i = 0; i < leftDeficiencySlots.length; i++) {
        addEdge(leftDeficiencySlots[i], rightDeficiencySlots[i])
    }

    // Extract `rotations` perfect matchings. Removing a perfect matching from
    // a k-regular bipartite (multi)graph leaves a (k-1)-regular graph, so
    // this never gets stuck partway through.
    const schedule = new Map<string, string[]>(
        lotteryOrder.map(id => [id, new Array(rotations).fill('')])
    )
    for (let rotation = 0; rotation < rotations; rotation++) {
        const adjacencyArrays = adjacency.map(map => Array.from(map.keys()))
        const matchOfLeft = findPerfectMatching(totalLeft, copyCount, adjacencyArrays)

        for (let left = 0; left < studentCount; left++) {
            const copyIndex = matchOfLeft[left]
            const studentId = lotteryOrder[left]
            const serviceId = copyServiceId[copyIndex]
            const assignment = schedule.get(studentId) as string[]
            assignment[rotation] = serviceId
        }

        for (let left = 0; left < totalLeft; left++) {
            const copy = matchOfLeft[left]
            const remaining = (adjacency[left].get(copy) as number) - 1
            if (remaining > 0) {
                adjacency[left].set(copy, remaining)
            } else {
                adjacency[left].delete(copy)
            }
        }
    }

    return schedule
}
