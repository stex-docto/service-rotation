import { useEffect, useState } from 'react'
import { CurrentUser } from '@domain'
import { useDependencies } from './useDependencies'

export interface CurrentUserState {
    user: CurrentUser | null
    loading: boolean
}

// `loading` stays true until the first auth callback fires, so callers can
// tell "not signed in" apart from "still restoring the persisted session".
export function useCurrentUser(): CurrentUserState {
    const { signInUseCase } = useDependencies()
    const [state, setState] = useState<CurrentUserState>({ user: null, loading: true })

    useEffect(() => {
        return signInUseCase.onAuthStateChanged(user => {
            setState({ user, loading: false })
        })
    }, [signInUseCase])

    return state
}
