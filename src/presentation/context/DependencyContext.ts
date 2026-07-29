import { createContext } from 'react'
import {
    AddRotationSlotUseCase,
    AddServiceUseCase,
    BanMemberUseCase,
    CloseInviteUseCase,
    ComputeResultUseCase,
    CreateGroupUseCase,
    GetGroupUseCase,
    GetMyGroupsUseCase,
    GetMyVoteUseCase,
    GetVotingProgressUseCase,
    JoinGroupUseCase,
    LeaveGroupUseCase,
    LockVoteUseCase,
    OpenGroupUseCase,
    RemoveRotationSlotUseCase,
    ReopenInviteUseCase,
    RemoveServiceUseCase,
    SaveVoteDraftUseCase,
    SetGroupHiddenUseCase,
    SetRotationModeUseCase,
    SignInUseCase,
    UnbanMemberUseCase,
    UpdateGroupSettingsUseCase,
    UpdateRotationSlotUseCase,
    UpdateServiceUseCase
} from '@application'

export interface DependencyContext {
    signInUseCase: SignInUseCase
    createGroupUseCase: CreateGroupUseCase
    updateGroupSettingsUseCase: UpdateGroupSettingsUseCase
    addServiceUseCase: AddServiceUseCase
    updateServiceUseCase: UpdateServiceUseCase
    removeServiceUseCase: RemoveServiceUseCase
    addRotationSlotUseCase: AddRotationSlotUseCase
    removeRotationSlotUseCase: RemoveRotationSlotUseCase
    updateRotationSlotUseCase: UpdateRotationSlotUseCase
    setRotationModeUseCase: SetRotationModeUseCase
    openGroupUseCase: OpenGroupUseCase
    joinGroupUseCase: JoinGroupUseCase
    leaveGroupUseCase: LeaveGroupUseCase
    banMemberUseCase: BanMemberUseCase
    unbanMemberUseCase: UnbanMemberUseCase
    closeInviteUseCase: CloseInviteUseCase
    reopenInviteUseCase: ReopenInviteUseCase
    saveVoteDraftUseCase: SaveVoteDraftUseCase
    lockVoteUseCase: LockVoteUseCase
    computeResultUseCase: ComputeResultUseCase
    getVotingProgressUseCase: GetVotingProgressUseCase
    getGroupUseCase: GetGroupUseCase
    getMyVoteUseCase: GetMyVoteUseCase
    getMyGroupsUseCase: GetMyGroupsUseCase
    setGroupHiddenUseCase: SetGroupHiddenUseCase
}

export const Dependencies = createContext<DependencyContext | undefined>(undefined)
