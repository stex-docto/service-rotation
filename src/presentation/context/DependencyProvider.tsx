import React, { useState } from 'react'
import { GroupRepository, ResultRepository, SubmissionRepository, UserRepository } from '@domain'
import {
    AddRosterEntryUseCase,
    AddServiceUseCase,
    CloseSubmissionsUseCase,
    ComputeResultUseCase,
    CreateGroupUseCase,
    GetAllSubmissionsUseCase,
    GetGroupUseCase,
    GetMyGroupsUseCase,
    GetMySubmissionUseCase,
    GetResultUseCase,
    OpenSubmissionsUseCase,
    RemoveRosterEntryUseCase,
    RemoveServiceUseCase,
    SignInUseCase,
    SubmitGradesUseCase,
    UpdateGroupSettingsUseCase,
    UpdateServiceUseCase
} from '@application'
import { FirebaseGroupDatastore } from '@infrastructure/datastores/FirebaseGroupDatastore'
import { FirebaseSubmissionDatastore } from '@infrastructure/datastores/FirebaseSubmissionDatastore'
import { FirebaseResultDatastore } from '@infrastructure/datastores/FirebaseResultDatastore'
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
    const submissionRepository: SubmissionRepository = new FirebaseSubmissionDatastore(
        firebase.firestore,
        firebase.auth
    )
    const resultRepository: ResultRepository = new FirebaseResultDatastore(firebase.firestore)

    const signInUseCase = new SignInUseCase(userRepository)
    const createGroupUseCase = new CreateGroupUseCase(groupRepository, signInUseCase)
    const updateGroupSettingsUseCase = new UpdateGroupSettingsUseCase(
        groupRepository,
        signInUseCase
    )
    const addServiceUseCase = new AddServiceUseCase(groupRepository, signInUseCase)
    const updateServiceUseCase = new UpdateServiceUseCase(groupRepository, signInUseCase)
    const removeServiceUseCase = new RemoveServiceUseCase(groupRepository, signInUseCase)
    const addRosterEntryUseCase = new AddRosterEntryUseCase(groupRepository, signInUseCase)
    const removeRosterEntryUseCase = new RemoveRosterEntryUseCase(groupRepository, signInUseCase)
    const openSubmissionsUseCase = new OpenSubmissionsUseCase(groupRepository, signInUseCase)
    const computeResultUseCase = new ComputeResultUseCase(
        groupRepository,
        submissionRepository,
        resultRepository,
        signInUseCase
    )
    const submitGradesUseCase = new SubmitGradesUseCase(
        groupRepository,
        submissionRepository,
        signInUseCase,
        computeResultUseCase
    )
    const closeSubmissionsUseCase = new CloseSubmissionsUseCase(computeResultUseCase)
    const getGroupUseCase = new GetGroupUseCase(groupRepository)
    const getResultUseCase = new GetResultUseCase(resultRepository)
    const getMySubmissionUseCase = new GetMySubmissionUseCase(submissionRepository, signInUseCase)
    const getAllSubmissionsUseCase = new GetAllSubmissionsUseCase(submissionRepository)
    const getMyGroupsUseCase = new GetMyGroupsUseCase(groupRepository, signInUseCase)

    return {
        signInUseCase,
        createGroupUseCase,
        updateGroupSettingsUseCase,
        addServiceUseCase,
        updateServiceUseCase,
        removeServiceUseCase,
        addRosterEntryUseCase,
        removeRosterEntryUseCase,
        openSubmissionsUseCase,
        submitGradesUseCase,
        computeResultUseCase,
        closeSubmissionsUseCase,
        getGroupUseCase,
        getResultUseCase,
        getMySubmissionUseCase,
        getAllSubmissionsUseCase,
        getMyGroupsUseCase
    }
}

// Firebase's own singleton init is synchronous, so unlike a typical
// composition root there is nothing to await here — no loading state needed
// before the Provider can render.
export function DependencyProvider({ children }: DependencyProviderProps) {
    const [dependencies] = useState<DependencyContext>(initDependencies)

    return <Dependencies.Provider value={dependencies}>{children}</Dependencies.Provider>
}
