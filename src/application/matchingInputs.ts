import { deriveLotteryOrder, deriveLotterySeedFromVotes, GroupEntity, VoteEntity } from '@domain'
import { computeWeightedCost } from '@domain/matching'
import type { MatchingInput } from '@domain/matching'

// Built from whichever locked votes are currently readable to the caller —
// see VoteRepository.findReadable and ComputeResultUseCase. The lottery seed
// is derived from the votes themselves (see lottery.ts), not pre-committed
// by the group, so this never needs anything from the group beyond its
// services/rotations — and a different subset of votes (a provisional
// compute before everyone's in) naturally yields a different seed and order.
export function buildMatchingInput(group: GroupEntity, votes: VoteEntity[]): MatchingInput {
    const services = group.getServices().map(service => ({
        serviceId: service.id.value,
        capacityPerRotation: service.capacity
    }))

    // Keyed by service NAME, not ServiceId — see deriveLotterySeedFromVotes
    // for why: a ServiceId is a fresh random uuid per creation, which would
    // silently break reproducibility across two otherwise-identical groups.
    const serviceNameById = new Map(
        group.getServices().map(service => [service.id.value, service.name])
    )
    const seed = deriveLotterySeedFromVotes(
        votes.map(vote => ({
            id: vote.userId.value,
            grades: new Map(
                [...vote.grades].map(([serviceId, grade]) => [
                    serviceNameById.get(serviceId) ?? serviceId,
                    grade.level
                ])
            )
        }))
    )
    const lotteryOrder = deriveLotteryOrder(
        seed,
        votes.map(vote => vote.userId.value)
    )

    const students = votes.map(vote => {
        const costs = new Map<string, number>()
        // Only when the flag is on: shiftHistory otherwise stays empty on
        // any group that never enabled it, but computing straight from an
        // empty map here would still be correct — this branch exists so the
        // output is trivially, structurally unchanged (not just numerically
        // equal) for every group that has never touched the feature.
        const shiftHistory = group.pastShiftsEnabled ? group.getShiftHistoryFor(vote.userId) : null
        for (const service of group.getServices()) {
            const grade = vote.gradeFor(service.id)
            if (!grade) continue
            const cost = shiftHistory
                ? computeWeightedCost(
                      grade.cost,
                      // Explicit zero-default at this read site, not left to
                      // whatever the datastore happens to return: a missing
                      // entry must never reach computeWeightedCost as
                      // undefined, since min(undefined, cap) is NaN and a
                      // single NaN cost silently poisons every comparison
                      // inside the min-cost flow without throwing.
                      shiftHistory.get(service.id.value) ?? 0,
                      group.rotations
                  )
                : grade.cost
            costs.set(service.id.value, cost)
        }
        return { studentId: vote.userId.value, costs }
    })

    return {
        rotations: group.rotations,
        services,
        students,
        lotteryOrder,
        allowRepeatedServices: group.allowRepeatedServices
    }
}
