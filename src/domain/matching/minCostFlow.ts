// Generic min-cost flow network, solved via successive shortest augmenting
// paths (Bellman-Ford/SPFA per augmentation). Correct with negative-cost
// reverse edges because successive-shortest-path augmentation never creates a
// negative cycle (the standard MCMF invariant) — safe here since original
// edge costs are always non-negative.
//
// Scale target: dozens of students, single-digit services and rotations.
// O(V*E) per augmentation is intentionally simple over a Dijkstra-with-
// potentials speedup that would add complexity for no real benefit here.
interface FlowEdge {
    to: number
    capacity: number
    cost: number
    flow: number
}

export class FlowNetwork {
    private readonly adjacency: number[][]
    private readonly edges: FlowEdge[] = []

    constructor(readonly nodeCount: number) {
        this.adjacency = Array.from({ length: nodeCount }, () => [])
    }

    // Adds a forward edge and its zero-capacity residual twin. Edge indices are
    // always allocated in pairs starting at 0, so `edgeIndex ^ 1` is always the
    // paired reverse edge — the standard trick this module relies on.
    addEdge(from: number, to: number, capacity: number, cost: number): void {
        this.adjacency[from].push(this.edges.length)
        this.edges.push({ to, capacity, cost, flow: 0 })
        this.adjacency[to].push(this.edges.length)
        this.edges.push({ to: from, capacity: 0, cost: -cost, flow: 0 })
    }

    private residual(edgeIndex: number): number {
        const edge = this.edges[edgeIndex]
        return edge.capacity - edge.flow
    }

    private shortestPath(source: number, sink: number): number[] | null {
        const distance = new Array(this.nodeCount).fill(Infinity)
        const parentEdge = new Array(this.nodeCount).fill(-1)
        const inQueue = new Array(this.nodeCount).fill(false)
        distance[source] = 0

        const queue: number[] = [source]
        inQueue[source] = true

        while (queue.length > 0) {
            const node = queue.shift() as number
            inQueue[node] = false

            for (const edgeIndex of this.adjacency[node]) {
                if (this.residual(edgeIndex) <= 0) continue
                const edge = this.edges[edgeIndex]
                const next = edge.to
                if (distance[node] + edge.cost < distance[next]) {
                    distance[next] = distance[node] + edge.cost
                    parentEdge[next] = edgeIndex
                    if (!inQueue[next]) {
                        queue.push(next)
                        inQueue[next] = true
                    }
                }
            }
        }

        if (distance[sink] === Infinity) return null

        const path: number[] = []
        let node = sink
        while (node !== source) {
            const edgeIndex = parentEdge[node]
            path.push(edgeIndex)
            node = this.edges[edgeIndex ^ 1].to
        }
        path.reverse()
        return path
    }

    // Augments along shortest-by-cost paths until no path remains or `maxFlow`
    // is reached. Returns the achieved flow and its cost under THIS network's
    // costs (which may be tie-break-perturbed — callers that need the true,
    // unperturbed cost should recompute it from the resulting edge flows).
    minCostFlow(
        source: number,
        sink: number,
        maxFlow: number = Infinity
    ): { flow: number; cost: number } {
        let flow = 0
        let cost = 0

        for (;;) {
            if (flow >= maxFlow) break
            const path = this.shortestPath(source, sink)
            if (!path) break

            let bottleneck = maxFlow - flow
            for (const edgeIndex of path) {
                bottleneck = Math.min(bottleneck, this.residual(edgeIndex))
            }

            for (const edgeIndex of path) {
                this.edges[edgeIndex].flow += bottleneck
                this.edges[edgeIndex ^ 1].flow -= bottleneck
                cost += bottleneck * this.edges[edgeIndex].cost
            }

            flow += bottleneck
        }

        return { flow, cost }
    }

    // Flow actually carried on a specific forward edge, identified by its
    // index as returned from addEdge's call order (0-based, in call order).
    flowOnEdgeAt(callIndex: number): number {
        return this.edges[callIndex * 2].flow
    }
}
