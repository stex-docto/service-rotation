import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Text, VStack } from '@chakra-ui/react'
import { GroupEntity, GroupId } from '@domain'
import { useCurrentUser } from '@presentation/hooks/useCurrentUser'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { DraftAdminView } from './GroupPageParts/DraftAdminView'
import { OpenView } from './GroupPageParts/OpenView'
import { ComputedResultView } from './GroupPageParts/ComputedResultView'

export default function GroupPage() {
    const { groupId } = useParams<{ groupId: string }>()
    const { getGroupUseCase, signInUseCase } = useDependencies()
    const { user, loading: userLoading } = useCurrentUser()

    const [group, setGroup] = useState<GroupEntity | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!groupId) return
        setLoading(true)
        return getGroupUseCase.subscribe({ groupId: GroupId.from(groupId) }, result => {
            setGroup(result.group)
            setLoading(false)
        })
    }, [groupId, getGroupUseCase])

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
            </VStack>
        )
    }

    if (!group) {
        return (
            <VStack py={16} textAlign="center">
                <Text colorPalette="gray">
                    Ce groupe n'existe pas, ou vous n'y avez pas accès avec ce compte Google.
                </Text>
            </VStack>
        )
    }

    const isCreator = group.isCreator(user.id)

    if (group.status === 'draft') {
        if (!isCreator) {
            return (
                <VStack py={16} textAlign="center">
                    <Text colorPalette="gray">
                        Ce groupe n'est pas encore ouvert par son organisateur.
                    </Text>
                </VStack>
            )
        }
        return <DraftAdminView group={group} />
    }

    if (group.status === 'open') {
        return <OpenView group={group} isCreator={isCreator} currentUserEmail={user.email} />
    }

    return <ComputedResultView group={group} />
}
