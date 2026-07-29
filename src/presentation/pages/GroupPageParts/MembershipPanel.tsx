import { FormEvent, useState } from 'react'
import { Box, Button, Field, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { CurrentUser, GroupEntity, UserId } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'
import { ShareLink } from './ShareLink'

interface MembershipPanelProps {
    group: GroupEntity
    isCreator: boolean
    currentUser: CurrentUser
    // Whether the current user's own vote is already locked — irrelevant
    // (and omitted) before voting is enabled, since no vote can exist yet.
    voteLocked?: boolean
}

// Shared between the draft and open phases: the invite link, the creator's
// only two membership controls (lock/unlock new joins, ban an existing
// member), and the current user's own join/leave action. Voting itself is
// handled elsewhere — this panel only ever touches `members`/`memberUids`
// and `inviteOpen`.
export function MembershipPanel({
    group,
    isCreator,
    currentUser,
    voteLocked = false
}: MembershipPanelProps) {
    const {
        joinGroupUseCase,
        leaveGroupUseCase,
        banMemberUseCase,
        closeInviteUseCase,
        reopenInviteUseCase
    } = useDependencies()

    const isMember = group.isMember(currentUser.id)
    const members = group.getMembers()

    const [displayName, setDisplayName] = useState(currentUser.displayName)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [invitePending, setInvitePending] = useState(false)
    const [banningUserId, setBanningUserId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

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

    async function ban(userId: UserId) {
        setBanningUserId(userId.value)
        setError(null)
        try {
            await banMemberUseCase.execute({ groupId: group.id, userId })
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setBanningUserId(null)
        }
    }

    return (
        <VStack gap={4} align="stretch" borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
            <Heading size="sm">Membres ({members.length})</Heading>

            <ErrorMessage message={error} />

            {isCreator && (
                <>
                    <ShareLink groupId={group.id.value} />

                    <Box>
                        {group.status === 'open' && !group.inviteOpen ? (
                            <Text fontSize="xs" colorPalette="gray">
                                Les membres sont verrouillés définitivement depuis l'activation du
                                vote — pour l'équité, plus personne ne peut rejoindre désormais.
                            </Text>
                        ) : (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorPalette={group.inviteOpen ? 'orange' : 'blue'}
                                    onClick={toggleInvite}
                                    loading={invitePending}
                                >
                                    {group.inviteOpen
                                        ? 'Verrouiller les membres'
                                        : 'Rouvrir aux nouveaux membres'}
                                </Button>
                                <Text fontSize="xs" colorPalette="gray" mt={2}>
                                    {group.inviteOpen
                                        ? "Tant que c'est ouvert, quiconque a le lien peut rejoindre le groupe."
                                        : 'Plus personne ne peut rejoindre le groupe avec ce lien.'}
                                </Text>
                            </>
                        )}
                    </Box>
                </>
            )}

            {members.length > 0 && (
                <VStack align="stretch" gap={1}>
                    {members.map(member => (
                        <HStack key={member.userId.value} justify="space-between">
                            <Text fontSize="sm">{member.displayName}</Text>
                            {isCreator && !member.userId.equals(currentUser.id) && (
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    loading={banningUserId === member.userId.value}
                                    onClick={() => ban(member.userId)}
                                >
                                    Bannir
                                </Button>
                            )}
                        </HStack>
                    ))}
                </VStack>
            )}

            {!isMember &&
                (group.inviteOpen ? (
                    <Box as="form" onSubmit={join}>
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
                                Rejoindre ce groupe
                            </Button>
                        </VStack>
                    </Box>
                ) : (
                    <Text colorPalette="gray">Ce groupe n'accepte plus de nouveaux membres.</Text>
                ))}

            {isMember && (
                <Box>
                    {voteLocked ? (
                        <Text fontSize="sm" colorPalette="gray">
                            Vous ne pouvez plus quitter ce groupe : votre vote est verrouillé.
                        </Text>
                    ) : (
                        <>
                            <Text fontSize="sm" colorPalette="gray">
                                Vous pouvez quitter ce groupe tant que votre vote n'est pas
                                verrouillé.
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
                        </>
                    )}
                </Box>
            )}
        </VStack>
    )
}
