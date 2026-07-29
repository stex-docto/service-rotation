import {
    GradeLevel,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    ResultEntity,
    VoteEntity,
    VoteRepository
} from '@domain'
import { computeAssignment, InfeasibleError } from '@domain/matching'
import { SignInUseCase } from '@application'
import { buildMatchingInput } from '@application/matchingInputs'

export interface ComputeResultCommand {
    groupId: GroupId
}

// A live, local computation — never stored or shared as a canonical
// document (see README's security model). Anyone whose own vote is locked
// can call this at any time; it always runs over whichever OTHER members'
// votes are currently readable (see VoteRepository.findReadable), which may
// be a strict subset of the group if some members haven't voted yet. The
// caller is responsible for telling a provisional result (totalMembers >
// result.includedUserIds.length) from a stable one apart in the UI.
export interface ComputeResultResult {
    result: ResultEntity | null
    votes: VoteEntity[]
    totalMembers: number
}

export class ComputeResultUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly voteRepository: VoteRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: ComputeResultCommand): Promise<ComputeResultResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        const group = await this.groupRepository.findById(command.groupId)
        if (!group) {
            throw new GroupNotFoundError()
        }

        const myVote = await this.voteRepository.findMine(command.groupId, user.id)
        if (!myVote?.locked) {
            throw new Error('Lock your own vote before you can see any results')
        }

        const memberIds = group.getMembers().map(member => member.userId.value)
        const votes = await this.voteRepository.findReadable(command.groupId, memberIds)
        const totalMembers = memberIds.length

        if (votes.length === 0) {
            return { result: null, votes: [], totalMembers }
        }

        const input = buildMatchingInput(group, votes)

        try {
            const computed = computeAssignment(input)

            const votesByUserId = new Map(votes.map(vote => [vote.userId.value, vote.userId]))
            const servicesById = new Map(
                group.getServices().map(service => [service.id.value, service])
            )

            const assignments = computed.assignments.map(assignment => {
                const userId = votesByUserId.get(assignment.studentId)
                if (!userId) {
                    throw new Error(
                        `Internal invariant violated: assignment references unknown member ${assignment.studentId}`
                    )
                }
                return {
                    userId,
                    rotationServiceIds: assignment.rotationServiceIds.map(serviceIdValue => {
                        const service = servicesById.get(serviceIdValue)
                        if (!service) {
                            throw new Error(
                                `Internal invariant violated: assignment references unknown service ${serviceIdValue}`
                            )
                        }
                        return service.id
                    })
                }
            })

            const result = ResultEntity.create(
                command.groupId,
                assignments,
                // The matching engine's cost scale (0..3) is exactly Grade's
                // level scale by construction — see MAX_ACCEPTABLE_COST.
                computed.worstCost as GradeLevel,
                computed.totalCost,
                computed.theoreticalMinTotalCost,
                input.lotteryOrder.join(','),
                votes.map(vote => vote.userId.value)
            )

            return { result, votes, totalMembers }
        } catch (error) {
            if (error instanceof InfeasibleError) {
                return { result: null, votes, totalMembers }
            }
            throw error
        }
    }
}
