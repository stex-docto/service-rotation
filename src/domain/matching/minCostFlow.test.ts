import { describe, expect, it } from 'vitest'
import { FlowNetwork } from './minCostFlow'

describe('FlowNetwork', () => {
    it('solves a small textbook assignment problem at minimum cost', () => {
        // 2 workers x 2 tasks. Optimal pairing is W1->T1 (1) + W2->T2 (2) = 3,
        // versus W1->T2 (4) + W2->T1 (3) = 7.
        const source = 0
        const worker1 = 1
        const worker2 = 2
        const task1 = 3
        const task2 = 4
        const sink = 5

        const network = new FlowNetwork(6)
        network.addEdge(source, worker1, 1, 0) // call 0
        network.addEdge(source, worker2, 1, 0) // call 1
        network.addEdge(worker1, task1, 1, 1) // call 2
        network.addEdge(worker1, task2, 1, 4) // call 3
        network.addEdge(worker2, task1, 1, 3) // call 4
        network.addEdge(worker2, task2, 1, 2) // call 5
        network.addEdge(task1, sink, 1, 0) // call 6
        network.addEdge(task2, sink, 1, 0) // call 7

        const { flow, cost } = network.minCostFlow(source, sink, 2)

        expect(flow).toBe(2)
        expect(cost).toBe(3)
        expect(network.flowOnEdgeAt(2)).toBe(1) // W1 -> T1
        expect(network.flowOnEdgeAt(5)).toBe(1) // W2 -> T2
        expect(network.flowOnEdgeAt(3)).toBe(0) // W1 -> T2 unused
        expect(network.flowOnEdgeAt(4)).toBe(0) // W2 -> T1 unused
    })

    it('never exceeds a capped maxFlow even when more flow is available', () => {
        const network = new FlowNetwork(3)
        network.addEdge(0, 1, 5, 1) // call 0
        network.addEdge(1, 2, 5, 1) // call 1

        const { flow } = network.minCostFlow(0, 2, 2)

        expect(flow).toBe(2)
    })

    it('reports zero flow when source and sink are disconnected', () => {
        const network = new FlowNetwork(4)
        network.addEdge(0, 1, 5, 0)
        network.addEdge(2, 3, 5, 0)

        const { flow, cost } = network.minCostFlow(0, 3)

        expect(flow).toBe(0)
        expect(cost).toBe(0)
    })
})
