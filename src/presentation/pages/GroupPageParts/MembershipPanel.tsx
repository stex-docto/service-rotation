import { FormEvent, useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    Field,
    Heading,
    HStack,
    Input,
    Portal,
    Text,
    VStack
} from '@chakra-ui/react'
import { CurrentUser, GroupEntity, MemberEntry, UserId } from '@domain'
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
// membership controls (lock/unlock new joins, ban/unban a member), and the
// current user's own join/leave action. Voting itself is handled elsewhere —
// this panel only ever touches `members`/`memberUids`, `bannedMembers`/
// `bannedUids`, and `inviteOpen`.
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
        unbanMemberUseCase,
        closeInviteUseCase,
        reopenInviteUseCase
    } = useDependencies()

    const isMember = group.isMember(currentUser.id)
    const members = group.getMembers()
    const bannedMembers = group.getBannedMembers()

    const [displayName, setDisplayName] = useState(currentUser.displayName)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [invitePending, setInvitePending] = useState(false)
    const [banningUserId, setBanningUserId] = useState<string | null>(null)
    const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null)
    const [banTarget, setBanTarget] = useState<MemberEntry | null>(null)
    const [banAcknowledged, setBanAcknowledged] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function closeBanDialog() {
        setBanTarget(null)
        setBanAcknowledged(false)
    }

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

    async function confirmBan() {
        if (!banTarget) {
            return
        }
        const userId = banTarget.userId
        closeBanDialog()
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

    async function unban(userId: UserId) {
        setUnbanningUserId(userId.value)
        setError(null)
        try {
            await unbanMemberUseCase.execute({ groupId: group.id, userId })
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setUnbanningUserId(null)
        }
    }

    const rosterLocked = group.status !== 'draft' && !group.inviteOpen
    // Matches Group.unban's own guard: a ban can only be undone while the
    // roster isn't locked yet — true in draft, and forever false past that
    // point (whether locked manually or by opening the group for voting).
    const banIsUndoable = group.inviteOpen

    return (
        <VStack gap={4} align="stretch" borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
            <HStack justify="space-between">
                <Heading size="sm">Membres ({members.length})</Heading>
                {isCreator && !rosterLocked && (
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
                )}
            </HStack>

            <ErrorMessage message={error} />

            {isCreator && (
                <>
                    <ShareLink
                        groupId={group.id.value}
                        inviteOpen={group.inviteOpen}
                        rosterLocked={rosterLocked}
                    />

                    {bannedMembers.length > 0 && (
                        <Box>
                            <Text fontSize="xs" colorPalette="gray" mb={1}>
                                Bannis — ne peuvent pas rejoindre à nouveau.
                            </Text>
                            <VStack align="stretch" gap={1}>
                                {bannedMembers.map(member => (
                                    <HStack key={member.userId.value} justify="space-between">
                                        <Text fontSize="sm" colorPalette="gray">
                                            {member.displayName}
                                        </Text>
                                        {group.inviteOpen && (
                                            <Button
                                                size="xs"
                                                variant="ghost"
                                                loading={unbanningUserId === member.userId.value}
                                                onClick={() => unban(member.userId)}
                                            >
                                                Annuler le bannissement
                                            </Button>
                                        )}
                                    </HStack>
                                ))}
                            </VStack>
                        </Box>
                    )}
                </>
            )}

            {members.length > 0 && (
                <VStack align="stretch" gap={1}>
                    {members.map(member => {
                        const isSelf = member.userId.equals(currentUser.id)
                        return (
                            <HStack key={member.userId.value} justify="space-between">
                                <Text fontSize="sm">{member.displayName}</Text>
                                {isSelf
                                    ? !voteLocked && (
                                          <Button
                                              size="xs"
                                              variant="ghost"
                                              colorPalette="orange"
                                              loading={leaving}
                                              onClick={leave}
                                          >
                                              Quitter
                                          </Button>
                                      )
                                    : isCreator && (
                                          <Button
                                              size="xs"
                                              variant="ghost"
                                              colorPalette="red"
                                              loading={banningUserId === member.userId.value}
                                              onClick={() => setBanTarget(member)}
                                          >
                                              Bannir
                                          </Button>
                                      )}
                            </HStack>
                        )
                    })}
                </VStack>
            )}

            {!isMember &&
                (group.inviteOpen ? (
                    <Box as="form" onSubmit={join}>
                        <VStack gap={3} align="stretch">
                            <Field.Root required>
                                <Field.Label>Ton nom</Field.Label>
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
                <Text fontSize="xs" colorPalette={voteLocked ? 'gray' : 'orange'}>
                    {voteLocked
                        ? 'Tu ne peux plus quitter ce groupe : tes notes sont verrouillées.'
                        : 'Tu ne veux pas participer au tirage ? Utilise « Quitter » à côté de ton nom ci-dessus, tant que tes notes ne sont pas verrouillées.'}
                </Text>
            )}

            <Dialog.Root
                open={banTarget !== null}
                onOpenChange={details => !details.open && closeBanDialog()}
                role="alertdialog"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>Bannir {banTarget?.displayName} ?</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <VStack align="stretch" gap={3}>
                                    <Text>
                                        {banTarget?.displayName} sera immédiatement retiré du groupe
                                        et ne pourra plus voter ni voir les résultats.
                                    </Text>
                                    <Text>
                                        {banIsUndoable
                                            ? "Les membres ne sont pas encore verrouillés : tu pourras annuler ce bannissement plus tard si besoin, tant que ce n'est pas le cas."
                                            : 'Les membres sont verrouillés : ce bannissement est définitif, impossible à annuler, et cette personne ne pourra plus rejoindre avec ce lien.'}
                                    </Text>
                                    {group.status !== 'draft' && (
                                        <Text>
                                            Si ses notes étaient déjà verrouillées, elles seront
                                            simplement ignorées lors du calcul du tirage.
                                        </Text>
                                    )}
                                    {!banIsUndoable && (
                                        <Checkbox.Root
                                            checked={banAcknowledged}
                                            onCheckedChange={details =>
                                                setBanAcknowledged(!!details.checked)
                                            }
                                        >
                                            <Checkbox.HiddenInput />
                                            <Checkbox.Control />
                                            <Checkbox.Label>
                                                Je comprends que je ne peux pas annuler ce
                                                bannissement.
                                            </Checkbox.Label>
                                        </Checkbox.Root>
                                    )}
                                </VStack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="outline" onClick={closeBanDialog}>
                                    Annuler
                                </Button>
                                <Button
                                    colorPalette={banIsUndoable ? 'orange' : 'red'}
                                    disabled={!banIsUndoable && !banAcknowledged}
                                    loading={banningUserId === banTarget?.userId.value}
                                    onClick={confirmBan}
                                >
                                    {banIsUndoable ? 'Bannir' : 'Bannir définitivement'}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </VStack>
    )
}
