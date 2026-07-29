import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Badge, Box, Button, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { GroupEntity } from '@domain'
import { useCurrentUser } from '@presentation/hooks/useCurrentUser'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const STATUS_LABELS: Record<string, string> = {
    draft: 'Brouillon',
    open: 'Ouvert',
    computed: 'Calculé'
}

function GroupRow({ group }: { group: GroupEntity }) {
    return (
        <RouterLink to={`/group/${group.id.value}`}>
            <HStack
                justify="space-between"
                p={3}
                borderWidth="1px"
                borderRadius="md"
                _hover={{ bg: 'gray.50' }}
            >
                <Text fontWeight="medium">{group.name}</Text>
                <Badge
                    colorPalette={
                        group.status === 'computed'
                            ? 'green'
                            : group.status === 'open'
                              ? 'blue'
                              : 'gray'
                    }
                >
                    {STATUS_LABELS[group.status]}
                </Badge>
            </HStack>
        </RouterLink>
    )
}

export default function HomePage() {
    const { getMyGroupsUseCase, signInUseCase } = useDependencies()
    const { user, loading: userLoading } = useCurrentUser()
    const [created, setCreated] = useState<GroupEntity[]>([])
    const [participating, setParticipating] = useState<GroupEntity[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!user) {
            setLoading(false)
            return
        }
        setLoading(true)
        getMyGroupsUseCase
            .execute()
            .then(result => {
                setCreated(result.created)
                setParticipating(result.participating)
            })
            .catch(err => setError(errorMessageFrom(err)))
            .finally(() => setLoading(false))
    }, [user, getMyGroupsUseCase])

    if (userLoading) {
        return <LoadingScreen />
    }

    if (!user) {
        return (
            <VStack gap={6} py={16} textAlign="center">
                <Heading size="lg">Affectation des Stages</Heading>
                <Text maxW="480px" colorPalette="gray">
                    Répartissez équitablement les internes entre les services de stage, rotation
                    après rotation, sans possibilité de tricher sur ses choix.
                </Text>
                <Button
                    colorPalette="blue"
                    size="lg"
                    onClick={() => signInUseCase.signInWithGoogle()}
                >
                    Se connecter avec Google
                </Button>
            </VStack>
        )
    }

    return (
        <VStack gap={8} align="stretch">
            <HStack justify="space-between">
                <Heading size="lg">Mes groupes</Heading>
                <RouterLink to="/create">
                    <Button colorPalette="blue">Créer un groupe</Button>
                </RouterLink>
            </HStack>

            <ErrorMessage message={error} />

            {loading ? (
                <LoadingScreen />
            ) : (
                <>
                    <Box>
                        <Heading size="sm" mb={3}>
                            Créés par moi
                        </Heading>
                        {created.length === 0 ? (
                            <Text colorPalette="gray">Aucun groupe créé pour l'instant.</Text>
                        ) : (
                            <VStack gap={2} align="stretch">
                                {created.map(group => (
                                    <GroupRow key={group.id.value} group={group} />
                                ))}
                            </VStack>
                        )}
                    </Box>

                    <Box>
                        <Heading size="sm" mb={3}>
                            J'y participe
                        </Heading>
                        {participating.length === 0 ? (
                            <Text colorPalette="gray">
                                Vous ne participez à aucun groupe pour l'instant.
                            </Text>
                        ) : (
                            <VStack gap={2} align="stretch">
                                {participating.map(group => (
                                    <GroupRow key={group.id.value} group={group} />
                                ))}
                            </VStack>
                        )}
                    </Box>
                </>
            )}
        </VStack>
    )
}
