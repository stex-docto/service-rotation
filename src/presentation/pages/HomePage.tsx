import { ReactNode, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
    Badge,
    Box,
    Button,
    Collapsible,
    Heading,
    HStack,
    IconButton,
    Text,
    VStack
} from '@chakra-ui/react'
import { MdExpandMore, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { GroupEntity } from '@domain'
import { useCurrentUser } from '@presentation/hooks/useCurrentUser'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { GuestSignInButton } from '@presentation/components/GuestSignInButton'
import { errorMessageFrom } from '@presentation/utils/errors'

const STATUS_LABELS: Record<string, string> = {
    draft: 'Brouillon',
    open: 'Ouvert'
}

interface GroupRowProps {
    group: GroupEntity
    actionLabel: string
    actionIcon: ReactNode
    onAction: (group: GroupEntity) => void
}

function GroupRow({ group, actionLabel, actionIcon, onAction }: GroupRowProps) {
    return (
        <HStack
            justify="space-between"
            p={3}
            borderWidth="1px"
            borderRadius="md"
            _hover={{ bg: 'gray.50' }}
        >
            <RouterLink to={`/group/${group.id.value}`} style={{ flex: 1 }}>
                <HStack justify="space-between">
                    <Text fontWeight="medium">{group.name}</Text>
                    <Badge colorPalette={group.status === 'open' ? 'blue' : 'gray'}>
                        {STATUS_LABELS[group.status]}
                    </Badge>
                </HStack>
            </RouterLink>
            <IconButton
                aria-label={actionLabel}
                size="sm"
                variant="ghost"
                onClick={() => onAction(group)}
            >
                {actionIcon}
            </IconButton>
        </HStack>
    )
}

export default function HomePage() {
    const { getMyGroupsUseCase, setGroupHiddenUseCase, signInUseCase } = useDependencies()
    const { user, loading: userLoading } = useCurrentUser()
    const [created, setCreated] = useState<GroupEntity[]>([])
    const [participating, setParticipating] = useState<GroupEntity[]>([])
    const [hidden, setHidden] = useState<GroupEntity[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    function refresh() {
        setLoading(true)
        return getMyGroupsUseCase
            .execute()
            .then(result => {
                setCreated(result.created)
                setParticipating(result.participating)
                setHidden(result.hidden)
            })
            .catch(err => setError(errorMessageFrom(err)))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        if (!user) {
            setLoading(false)
            return
        }
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, getMyGroupsUseCase])

    async function setHiddenState(group: GroupEntity, isHidden: boolean) {
        try {
            await setGroupHiddenUseCase.execute({ groupId: group.id, hidden: isHidden })
            await refresh()
        } catch (err) {
            setError(errorMessageFrom(err))
        }
    }

    if (userLoading) {
        return <LoadingScreen />
    }

    if (!user) {
        return (
            <VStack gap={6} py={16} textAlign="center">
                <Heading size="lg">Affectation des Stages</Heading>
                <Text maxW="480px" colorPalette="gray">
                    Répartissez équitablement les externes entre les services de stage, rotation
                    après rotation, sans possibilité de tricher sur ses choix.
                </Text>
                <Button
                    colorPalette="blue"
                    size="lg"
                    onClick={() => signInUseCase.signInWithGoogle()}
                >
                    Se connecter avec Google
                </Button>
                <GuestSignInButton size="lg" />
            </VStack>
        )
    }

    return (
        <VStack gap={8} align="stretch">
            <ErrorMessage message={error} />

            {loading ? (
                <LoadingScreen />
            ) : (
                <>
                    <Box>
                        <Heading size="sm" mb={3}>
                            Mes participations
                        </Heading>
                        {participating.length === 0 ? (
                            <Text colorPalette="gray">
                                Tu ne participes à aucun groupe pour l'instant.
                            </Text>
                        ) : (
                            <VStack gap={2} align="stretch">
                                {participating.map(group => (
                                    <GroupRow
                                        key={group.id.value}
                                        group={group}
                                        actionLabel="Masquer ce groupe"
                                        actionIcon={<MdVisibilityOff />}
                                        onAction={group => setHiddenState(group, true)}
                                    />
                                ))}
                            </VStack>
                        )}
                    </Box>

                    <Box>
                        <HStack justify="space-between" mb={3}>
                            <Heading size="sm">Mes groupes</Heading>
                            <RouterLink to="/create">
                                <Button colorPalette="blue" size="sm">
                                    Créer un groupe
                                </Button>
                            </RouterLink>
                        </HStack>
                        {created.length === 0 ? (
                            <Text colorPalette="gray">Aucun groupe créé pour l'instant.</Text>
                        ) : (
                            <VStack gap={2} align="stretch">
                                {created.map(group => (
                                    <GroupRow
                                        key={group.id.value}
                                        group={group}
                                        actionLabel="Masquer ce groupe"
                                        actionIcon={<MdVisibilityOff />}
                                        onAction={group => setHiddenState(group, true)}
                                    />
                                ))}
                            </VStack>
                        )}
                    </Box>

                    {hidden.length > 0 && (
                        <Collapsible.Root>
                            <Collapsible.Trigger asChild>
                                <HStack cursor="pointer" color="gray.500" gap={1}>
                                    <MdExpandMore />
                                    <Text fontSize="sm">Groupes masqués ({hidden.length})</Text>
                                </HStack>
                            </Collapsible.Trigger>
                            <Collapsible.Content>
                                <VStack gap={2} align="stretch" mt={3}>
                                    {hidden.map(group => (
                                        <GroupRow
                                            key={group.id.value}
                                            group={group}
                                            actionLabel="Réafficher ce groupe"
                                            actionIcon={<MdVisibility />}
                                            onAction={group => setHiddenState(group, false)}
                                        />
                                    ))}
                                </VStack>
                            </Collapsible.Content>
                        </Collapsible.Root>
                    )}
                </>
            )}
        </VStack>
    )
}
