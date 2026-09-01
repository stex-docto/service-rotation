import React, { useState } from 'react'
import {
    GroupRepository,
    ShiftHistoryProposalRepository,
    UserPreferencesRepository,
    UserRepository,
    VoteRepository
} from '@domain'
import {
    AddRotationSlotUseCase,
    AddServiceUseCase,
    BanMemberUseCase,
    CloseInviteUseCase,
    ComputeResultUseCase,
    CreateGroupUseCase,
    DeleteGroupUseCase,
    FinishGroupUseCase,
    GetGroupUseCase,
    GetMyGroupsUseCase,
    GetMyVoteUseCase,
    GetShiftHistoryProposalsUseCase,
    GetVotingProgressUseCase,
    ImportShiftHistoryUseCase,
    JoinGroupUseCase,
    LeaveGroupUseCase,
    LockVoteUseCase,
    OpenGroupUseCase,
    ProposeShiftHistoryChangeUseCase,
    RemoveRotationSlotUseCase,
    ReopenInviteUseCase,
    RemoveServiceUseCase,
    ResolveShiftHistoryProposalUseCase,
    SaveVoteDraftUseCase,
    SetGroupHiddenUseCase,
    SetMemberShiftHistoryUseCase,
    SetRotationModeUseCase,
    SignInUseCase,
    UnbanMemberUseCase,
    UpdateGroupSettingsUseCase,
    UpdateRotationSlotUseCase,
    UpdateServiceUseCase
} from '@application'
import { FirebaseGroupDatastore } from '@infrastructure/datastores/FirebaseGroupDatastore'
import { FirebaseVoteDatastore } from '@infrastructure/datastores/FirebaseVoteDatastore'
import { FirebaseShiftHistoryProposalDatastore } from '@infrastructure/datastores/FirebaseShiftHistoryProposalDatastore'
import { FirebaseUserPreferencesDatastore } from '@infrastructure/datastores/FirebaseUserPreferencesDatastore'
import { FirebaseUserDatastore } from '@infrastructure/datastores/FirebaseUserDatastore'
import { Firebase } from '@infrastructure/firebase'
import { Dependencies, DependencyContext } from './DependencyContext'

interface DependencyProviderProps {
    children: React.ReactNode
}

function initDependencies(): DependencyContext {
    const firebase = Firebase.getInstance()

    const userRepository: UserRepository = new FirebaseUserDatastore(firebase.auth)
    const groupRepository: GroupRepository = new FirebaseGroupDatastore(
        firebase.firestore,
        firebase.auth
    )
    const voteRepository: VoteRepository = new FirebaseVoteDatastore(firebase.firestore)
    const userPreferencesRepository: UserPreferencesRepository =
        new FirebaseUserPreferencesDatastore(firebase.firestore)
    const shiftHistoryProposalRepository: ShiftHistoryProposalRepository =
        new FirebaseShiftHistoryProposalDatastore(firebase.firestore)

    const signInUseCase = new SignInUseCase(userRepository)
    const createGroupUseCase = new CreateGroupUseCase(groupRepository, signInUseCase)
    const deleteGroupUseCase = new DeleteGroupUseCase(groupRepository, signInUseCase)
    const updateGroupSettingsUseCase = new UpdateGroupSettingsUseCase(
        groupRepository,
        signInUseCase
    )
    const addServiceUseCase = new AddServiceUseCase(groupRepository, signInUseCase)
    const updateServiceUseCase = new UpdateServiceUseCase(groupRepository, signInUseCase)
    const removeServiceUseCase = new RemoveServiceUseCase(groupRepository, signInUseCase)
    const addRotationSlotUseCase = new AddRotationSlotUseCase(groupRepository, signInUseCase)
    const removeRotationSlotUseCase = new RemoveRotationSlotUseCase(groupRepository, signInUseCase)
    const updateRotationSlotUseCase = new UpdateRotationSlotUseCase(groupRepository, signInUseCase)
    const setRotationModeUseCase = new SetRotationModeUseCase(groupRepository, signInUseCase)
    const openGroupUseCase = new OpenGroupUseCase(groupRepository, signInUseCase)
    const finishGroupUseCase = new FinishGroupUseCase(
        groupRepository,
        voteRepository,
        signInUseCase
    )
    const joinGroupUseCase = new JoinGroupUseCase(groupRepository, signInUseCase)
    const leaveGroupUseCase = new LeaveGroupUseCase(groupRepository, voteRepository, signInUseCase)
    const banMemberUseCase = new BanMemberUseCase(groupRepository, signInUseCase)
    const unbanMemberUseCase = new UnbanMemberUseCase(groupRepository, signInUseCase)
    const closeInviteUseCase = new CloseInviteUseCase(groupRepository, signInUseCase)
    const reopenInviteUseCase = new ReopenInviteUseCase(groupRepository, signInUseCase)
    const saveVoteDraftUseCase = new SaveVoteDraftUseCase(
        groupRepository,
        voteRepository,
        signInUseCase
    )
    const lockVoteUseCase = new LockVoteUseCase(voteRepository, signInUseCase)
    const computeResultUseCase = new ComputeResultUseCase(
        groupRepository,
        voteRepository,
        signInUseCase
    )
    const getVotingProgressUseCase = new GetVotingProgressUseCase(groupRepository, voteRepository)
    const getGroupUseCase = new GetGroupUseCase(groupRepository)
    const getMyVoteUseCase = new GetMyVoteUseCase(voteRepository, signInUseCase)
    const getMyGroupsUseCase = new GetMyGroupsUseCase(
        groupRepository,
        userPreferencesRepository,
        signInUseCase
    )
    const setGroupHiddenUseCase = new SetGroupHiddenUseCase(
        userPreferencesRepository,
        signInUseCase
    )
    const setMemberShiftHistoryUseCase = new SetMemberShiftHistoryUseCase(
        groupRepository,
        signInUseCase
    )
    const importShiftHistoryUseCase = new ImportShiftHistoryUseCase(
        groupRepository,
        voteRepository,
        signInUseCase
    )
    const proposeShiftHistoryChangeUseCase = new ProposeShiftHistoryChangeUseCase(
        groupRepository,
        shiftHistoryProposalRepository,
        signInUseCase
    )
    const resolveShiftHistoryProposalUseCase = new ResolveShiftHistoryProposalUseCase(
        groupRepository,
        shiftHistoryProposalRepository,
        signInUseCase
    )
    const getShiftHistoryProposalsUseCase = new GetShiftHistoryProposalsUseCase(
        groupRepository,
        shiftHistoryProposalRepository
    )

    return {
        signInUseCase,
        createGroupUseCase,
        deleteGroupUseCase,
        updateGroupSettingsUseCase,
        addServiceUseCase,
        updateServiceUseCase,
        removeServiceUseCase,
        addRotationSlotUseCase,
        removeRotationSlotUseCase,
        updateRotationSlotUseCase,
        setRotationModeUseCase,
        openGroupUseCase,
        finishGroupUseCase,
        joinGroupUseCase,
        leaveGroupUseCase,
        banMemberUseCase,
        unbanMemberUseCase,
        closeInviteUseCase,
        reopenInviteUseCase,
        saveVoteDraftUseCase,
        lockVoteUseCase,
        computeResultUseCase,
        getVotingProgressUseCase,
        getGroupUseCase,
        getMyVoteUseCase,
        getMyGroupsUseCase,
        setGroupHiddenUseCase,
        setMemberShiftHistoryUseCase,
        importShiftHistoryUseCase,
        proposeShiftHistoryChangeUseCase,
        resolveShiftHistoryProposalUseCase,
        getShiftHistoryProposalsUseCase
    }
}

// Firebase's own singleton init is synchronous, so unlike a typical
// composition root there is nothing to await here — no loading state needed
// before the Provider can render.
export function DependencyProvider({ children }: DependencyProviderProps) {
    const [dependencies] = useState<DependencyContext>(initDependencies)

    return <Dependencies.Provider value={dependencies}>{children}</Dependencies.Provider>
}
