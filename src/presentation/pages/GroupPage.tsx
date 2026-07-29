import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Text, VStack } from '@chakra-ui/react'
import { GroupEntity, GroupId } from '@domain'
import { useCurrentUser } from '@presentation/hooks/useCurrentUser'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { GuestSignInButton } from '@presentation/components/GuestSignInButton'
import { DraftAdminView } from './GroupPageParts/DraftAdminView'
import { OpenView } from './GroupPageParts/OpenView'

export default function GroupPage() {
    const { groupId } = useParams<{ groupId: string }>()
    const { getGroupUseCase, signInUseCase } = useDependencies()
    const { user, loading: userLoading } = useCurrentUser()

    const [group, setGroup] = useState<GroupEntity | null>(null)
    const [loading, setLoading] = useState(true)

    // Waits for `user` rather than firing on mount: subscribing before
    // sign-in resolves would attach the Firestore listener while
    // unauthenticated, which firestore.rules always denies — and unlike a
    // transient network error, `onSnapshot` never retries a permission
    // failure on its own once the user then signs in. Re-keying on the uid
    // (not the whole `user` object, which is a fresh reference every auth
    // callback) re-subscribes exactly once sign-in actually happens.
    useEffect(() => {
        if (!groupId) return
        if (!user) {
            // Not signed in (yet, or at all) — nothing to subscribe to.
            // `loading` must still resolve to false so the "not signed in"
            // branch below can render instead of spinning forever.
            setLoading(false)
            return
        }
        setLoading(true)
        return getGroupUseCase.subscribe({ groupId: GroupId.from(groupId) }, result => {
            setGroup(result.group)
            setLoading(false)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, getGroupUseCase, user?.id.value])

    if (userLoading || loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return (
            <VStack gap={4} py={16} textAlign="center">
                <Text>Connectez-vous pour accéder à ce groupe.</Text>
                <Button colorPalette="blue" onClick={() => signInUseCase.signInWithGoogle()}>
                    Se connecter avec Google
                </Button>
                <GuestSignInButton />
            </VStack>
        )
    }

    if (!group) {
        return (
            <VStack py={16} textAlign="center">
                <Text colorPalette="gray">
                    Ce groupe n'existe pas, ou vous n'y avez pas accès avec ce compte.
                </Text>
            </VStack>
        )
    }

    const isCreator = group.isCreator(user.id)

    if (group.status === 'draft') {
        return <DraftAdminView group={group} isCreator={isCreator} currentUser={user} />
    }

    // Membership and voting are uid-based throughout — a guest (anonymous)
    // session works exactly like a Google one here, no email needed.
    return <OpenView group={group} isCreator={isCreator} currentUser={user} />
}
