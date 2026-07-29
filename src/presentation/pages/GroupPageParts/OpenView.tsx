import { FormEvent, useEffect, useState } from 'react'
import { Box, Button, Field, Heading, Input, Progress, Text, VStack } from '@chakra-ui/react'
import { CurrentUser, GroupEntity, VoteEntity } from '@domain'
import { ComputeResultResult } from '@application'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'
import { ShareLink } from './ShareLink'
import { GradeSheetForm } from './GradeSheetForm'
import { LiveResultView } from './LiveResultView'

interface OpenViewProps {
    group: GroupEntity
    isCreator: boolean
    currentUser: CurrentUser
}

export function OpenView({ group, isCreator, currentUser }: OpenViewProps) {
    const {
        joinGroupUseCase,
        leaveGroupUseCase,
        closeInviteUseCase,
        reopenInviteUseCase,
        getMyVoteUseCase,
        getVotingProgressUseCase,
        computeResultUseCase
    } = useDependencies()

    const isMember = group.isMember(currentUser.id)

    const [displayName, setDisplayName] = useState(currentUser.displayName)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [invitePending, setInvitePending] = useState(false)

    const [myVote, setMyVote] = useState<VoteEntity | null>(null)
    const [loadingVote, setLoadingVote] = useState(isMember)

    const [progress, setProgress] = useState({
        lockedCount: 0,
        totalMembers: group.getMembers().length
    })

    const [computeResult, setComputeResult] = useState<ComputeResultResult | null>(null)
    const [computing, setComputing] = useState(false)

    const [error, setError] = useState<string | null>(null)

    function refreshMyVote() {
        setLoadingVote(true)
        return getMyVoteUseCase
            .execute({ groupId: group.id })
            .then(result => setMyVote(result.vote))
            .finally(() => setLoadingVote(false))
    }

    useEffect(() => {
        if (!isMember) return
        refreshMyVote()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMember, group.id, getMyVoteUseCase])

    useEffect(() => {
        getVotingProgressUseCase
            .execute({ groupId: group.id })
            .then(result =>
                setProgress({
                    lockedCount: result.statuses.filter(status => status.locked).length,
                    totalMembers: result.totalMembers
                })
            )
            .catch(() => {
                // Best-effort progress indicator — a failed read just leaves
                // the previous count showing.
            })
    }, [group.id, getVotingProgressUseCase, myVote])

    async function join(event: FormEvent) {
        event.preventDefault()
        setJoining(true)
        setError(null)
        try {
            await joinGroupUseCase.execute({ groupId: group.id, displayName: displayName.trim() })
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setJoining(false)
        }
    }

    async function leave() {
        setLeaving(true)
        setError(null)
        try {
            await leaveGroupUseCase.execute({ groupId: group.id })
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setLeaving(false)
        }
    }

    async function toggleInvite() {
        setInvitePending(true)
        setError(null)
        try {
            if (group.inviteOpen) {
                await closeInviteUseCase.execute({ groupId: group.id })
            } else {
                await reopenInviteUseCase.execute({ groupId: group.id })
            }
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setInvitePending(false)
        }
    }

    async function computeNow() {
        setComputing(true)
        setError(null)
        try {
            const result = await computeResultUseCase.execute({ groupId: group.id })
            setComputeResult(result)
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setComputing(false)
        }
    }

    // Auto-display once everyone currently in the group has locked a vote —
    // no click needed for the common case. The manual button below still
    // covers the provisional case (some members haven't voted yet) and lets
    // anyone force a fresh recompute afterward.
    useEffect(() => {
        if (!myVote?.locked) return
        if (progress.totalMembers === 0 || progress.lockedCount !== progress.totalMembers) return
        if (computeResult || computing) return
        computeNow()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myVote?.locked, progress.lockedCount, progress.totalMembers])

    return (
        <VStack gap={6} align="stretch">
            <Box>
                <Heading size="lg">{group.name}</Heading>
                <Text colorPalette="gray">
                    {progress.lockedCount} / {progress.totalMembers} membres ont verrouillé leur
                    vote.
                </Text>
                <Progress.Root
                    value={progress.lockedCount}
                    max={Math.max(progress.totalMembers, 1)}
                    mt={2}
                    colorPalette="blue"
                >
                    <Progress.Track>
                        <Progress.Range />
                    </Progress.Track>
                </Progress.Root>
            </Box>

            <ErrorMessage message={error} />

            {isCreator && (
                <VStack gap={4} align="stretch" borderWidth="1px" borderRadius="md" p={4}>
                    <Heading size="sm">Administration</Heading>
                    <ShareLink groupId={group.id.value} />
                    <Box>
                        <Button
                            variant="outline"
                            colorPalette={group.inviteOpen ? 'orange' : 'blue'}
                            onClick={toggleInvite}
                            loading={invitePending}
                        >
                            {group.inviteOpen ? "Fermer l'invitation" : "Rouvrir l'invitation"}
                        </Button>
                        <Text fontSize="xs" colorPalette="gray" mt={2}>
                            {group.inviteOpen
                                ? "Tant que l'invitation est ouverte, quiconque a le lien peut rejoindre le groupe."
                                : 'Plus personne ne peut rejoindre le groupe avec ce lien.'}
                        </Text>
                    </Box>
                </VStack>
            )}

            {!isMember && (
                <Box as="form" onSubmit={join} borderWidth="1px" borderRadius="md" p={4}>
                    <Heading size="sm" mb={3}>
                        Rejoindre ce groupe
                    </Heading>
                    {!group.inviteOpen ? (
                        <Text colorPalette="gray">
                            Ce groupe n'accepte plus de nouveaux membres.
                        </Text>
                    ) : (
                        <VStack gap={3} align="stretch">
                            <Field.Root required>
                                <Field.Label>Votre nom</Field.Label>
                                <Input
                                    value={displayName}
                                    onChange={event => setDisplayName(event.target.value)}
                                    required
                                />
                            </Field.Root>
                            <Button
                                type="submit"
                                colorPalette="blue"
                                loading={joining}
                                alignSelf="flex-start"
                            >
                                Rejoindre
                            </Button>
                        </VStack>
                    )}
                </Box>
            )}

            {isMember &&
                (loadingVote ? (
                    <LoadingScreen />
                ) : myVote?.locked ? (
                    !computeResult && (
                        <Box borderWidth="1px" borderRadius="md" p={4}>
                            <Heading size="sm" mb={2}>
                                Vote verrouillé
                            </Heading>
                            <Text colorPalette="gray">
                                Votre vote est enregistré définitivement. Vous pouvez maintenant
                                voir les résultats calculés à partir des votes déjà verrouillés.
                            </Text>
                        </Box>
                    )
                ) : (
                    <GradeSheetForm group={group} existingVote={myVote} onChanged={refreshMyVote} />
                ))}

            {isMember && !myVote?.locked && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                    <Text colorPalette="gray" fontSize="sm">
                        Vous pouvez quitter ce groupe tant que votre vote n'est pas verrouillé.
                    </Text>
                    <Button
                        size="sm"
                        variant="ghost"
                        colorPalette="red"
                        onClick={leave}
                        loading={leaving}
                        mt={2}
                    >
                        Quitter le groupe
                    </Button>
                </Box>
            )}

            {myVote?.locked && !computeResult && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                    <Button colorPalette="blue" onClick={computeNow} loading={computing}>
                        Voir les résultats
                    </Button>
                </Box>
            )}

            {computeResult && <LiveResultView group={group} computeResult={computeResult} />}
        </VStack>
    )
}
