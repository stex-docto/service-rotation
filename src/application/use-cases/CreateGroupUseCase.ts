import {
    GroupEntity,
    GroupId,
    GroupNotFoundError,
    GroupRepository,
    MemberEntry,
    PermissionError,
    ServiceEntity
} from '@domain'
import { SignInUseCase } from '@application'

export interface CreateGroupCommand {
    name: string
    // When set, pre-fills the new draft's services, rotation slot count and
    // allowRepeatedServices from a group the caller already has access to
    // (created or joined) — see README's continuation-group section. The
    // source's rotation slots aren't copied verbatim: dates/names belong to
    // the new period and are re-entered, only the count carries over.
    sourceGroupId?: GroupId
}

export interface CreateGroupResult {
    group: GroupEntity
}

export class CreateGroupUseCase {
    constructor(
        private readonly groupRepository: GroupRepository,
        private readonly signInUseCase: SignInUseCase
    ) {}

    async execute(command: CreateGroupCommand): Promise<CreateGroupResult> {
        const user = await this.signInUseCase.requireCurrentUser()

        let group = GroupEntity.create(command.name, user.id, undefined, command.sourceGroupId)

        if (command.sourceGroupId) {
            const source = await this.groupRepository.findById(command.sourceGroupId)
            if (!source) {
                throw new GroupNotFoundError()
            }
            if (!source.isCreator(user.id) && !source.isMember(user.id)) {
                throw new PermissionError('You do not have access to the source group')
            }

            for (const service of source.getServices()) {
                group = group.addService(
                    ServiceEntity.create(service.name, service.description, service.capacity)
                )
            }
            for (let i = 0; i < source.rotations; i++) {
                group = group.addRotationSlot()
            }
            group = group.updateSettings({
                allowRepeatedServices: source.allowRepeatedServices
            })
        }

        // firestore.rules' `create` requires an empty roster, so the creator
        // joins as a second write right away — same self-join path anyone
        // else uses, meaning they can leave later if they don't want to vote.
        // Prefilled services/rotationSlots/allowRepeatedServices ride along
        // in this same first write — the `create` rule doesn't restrict
        // which fields are present, only createdBy/status/members/
        // memberUids/inviteOpen/bannedMembers/bannedUids.
        await this.groupRepository.save(group)
        const entry = MemberEntry.create(user.id.value, user.displayName)
        const joinedGroup = await this.groupRepository.join(group.id, entry)

        return { group: joinedGroup }
    }
}
