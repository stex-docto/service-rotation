import { useEffect, useState } from 'react'
import { Box, Button, Heading, Progress, Text, VStack } from '@chakra-ui/react'
import { Email, GroupEntity, SubmissionEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'
import { ShareLink } from './ShareLink'
import { GradeSheetForm } from './GradeSheetForm'

interface OpenViewProps {
    group: GroupEntity
    isCreator: boolean
    currentUserEmail: Email
}

export function OpenView({ group, isCreator, currentUserEmail }: OpenViewProps) {
    const { getMySubmissionUseCase, closeSubmissionsUseCase, computeResultUseCase } =
        useDependencies()
    const isOnRoster = group.roster.has(currentUserEmail)

    const [mySubmission, setMySubmission] = useState<SubmissionEntity | null>(null)
    const [justSubmitted, setJustSubmitted] = useState(false)
    const [loadingSubmission, setLoadingSubmission] = useState(isOnRoster)
    const [closing, setClosing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOnRoster) return
        setLoadingSubmission(true)
        getMySubmissionUseCase
            .execute({ groupId: group.id })
            .then(result => setMySubmission(result.submission))
            .finally(() => setLoadingSubmission(false))
    }, [isOnRoster, group.id, getMySubmissionUseCase])

    // Recovery: if the roster completed but nothing computed the result (the
    // last submitter's tab closed mid-flight, say), whoever next opens the
    // group retries — see ComputeResultUseCase.
    useEffect(() => {
        if (group.allSubmitted()) {
            computeResultUseCase.execute({ groupId: group.id }).catch(() => {
                // Best-effort — the next viewer, or the organizer's "close
                // early" button, will retry.
            })
        }
    }, [group, computeResultUseCase])

    async function closeEarly() {
        setClosing(true)
        setError(null)
        try {
            await closeSubmissionsUseCase.execute({ groupId: group.id })
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setClosing(false)
        }
    }

    const submittedCount = group.submittedEmails.length
    const rosterSize = group.roster.size

    return (
        <VStack gap={6} align="stretch">
            <Box>
                <Heading size="lg">{group.name}</Heading>
                <Text colorPalette="gray">
                    {submittedCount} / {rosterSize} internes ont soumis leurs notes.
                </Text>
                <Progress.Root
                    value={submittedCount}
                    max={Math.max(rosterSize, 1)}
                    mt={2}
                    colorPalette="blue"
                >
                    <Progress.Track>
                        <Progress.Range />
                    </Progress.Track>
                </Progress.Root>
            </Box>

            {isCreator && (
                <VStack gap={4} align="stretch" borderWidth="1px" borderRadius="md" p={4}>
                    <Heading size="sm">Administration</Heading>
                    <ShareLink groupId={group.id.value} />
                    <ErrorMessage message={error} />
                    <Box>
                        <Button
                            colorPalette="orange"
                            variant="outline"
                            onClick={closeEarly}
                            loading={closing}
                        >
                            Clôturer maintenant et calculer
                        </Button>
                        <Text fontSize="xs" colorPalette="gray" mt={2}>
                            Les internes n'ayant pas encore soumis seront traités comme indifférents
                            à tous les services (aucun favori, aucun refus).
                        </Text>
                    </Box>
                </VStack>
            )}

            {isOnRoster &&
                (loadingSubmission ? (
                    <LoadingScreen />
                ) : mySubmission || justSubmitted ? (
                    <Box borderWidth="1px" borderRadius="md" p={4}>
                        <Heading size="sm" mb={2}>
                            Notes déjà soumises
                        </Heading>
                        <Text colorPalette="gray">
                            Merci ! Vos notes sont enregistrées définitivement. Le résultat sera
                            calculé automatiquement une fois que tout le monde aura soumis les
                            siennes.
                        </Text>
                    </Box>
                ) : (
                    <GradeSheetForm group={group} onSubmitted={() => setJustSubmitted(true)} />
                ))}
        </VStack>
    )
}
