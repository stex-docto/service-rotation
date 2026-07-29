// Kuhn's algorithm (augmenting paths), used by edgeColouring.ts to extract one
// perfect matching per rotation out of a k-regular bipartite graph. O(V*E),
// deliberately simple over Hopcroft-Karp: graphs here are tens of nodes.
//
// `adjacency[left]` must be iterated in a fixed, caller-controlled order for
// the overall pipeline to stay deterministic — this function does not sort.
export function findPerfectMatching(
    leftCount: number,
    rightCount: number,
    adjacency: number[][]
): number[] {
    const matchOfRight = new Array(rightCount).fill(-1)

    function tryAugment(left: number, visited: boolean[]): boolean {
        for (const right of adjacency[left]) {
            if (visited[right]) continue
            visited[right] = true
            if (matchOfRight[right] === -1 || tryAugment(matchOfRight[right], visited)) {
                matchOfRight[right] = left
                return true
            }
        }
        return false
    }

    for (let left = 0; left < leftCount; left++) {
        const visited = new Array(rightCount).fill(false)
        if (!tryAugment(left, visited)) {
            // Should be unreachable: callers only invoke this on a graph that is
            // regular of the same degree on both sides, which by Hall's theorem
            // always has a perfect matching.
            throw new Error(
                'Expected a perfect matching but found none — regularity invariant violated'
            )
        }
    }

    const matchOfLeft = new Array(leftCount).fill(-1)
    for (let right = 0; right < rightCount; right++) {
        if (matchOfRight[right] !== -1) {
            matchOfLeft[matchOfRight[right]] = right
        }
    }
    return matchOfLeft
}
