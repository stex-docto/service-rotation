import { createContext } from 'react'
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

export interface DependencyContext {
    signInUseCase: SignInUseCase
    createGroupUseCase: CreateGroupUseCase
    updateGroupSettingsUseCase: UpdateGroupSettingsUseCase
    addServiceUseCase: AddServiceUseCase
    updateServiceUseCase: UpdateServiceUseCase
    removeServiceUseCase: RemoveServiceUseCase
    addRosterEntryUseCase: AddRosterEntryUseCase
    removeRosterEntryUseCase: RemoveRosterEntryUseCase
    openSubmissionsUseCase: OpenSubmissionsUseCase
    submitGradesUseCase: SubmitGradesUseCase
    computeResultUseCase: ComputeResultUseCase
    closeSubmissionsUseCase: CloseSubmissionsUseCase
    getGroupUseCase: GetGroupUseCase
    getResultUseCase: GetResultUseCase
    getMySubmissionUseCase: GetMySubmissionUseCase
    getAllSubmissionsUseCase: GetAllSubmissionsUseCase
    getMyGroupsUseCase: GetMyGroupsUseCase
}

export const Dependencies = createContext<DependencyContext | undefined>(undefined)
