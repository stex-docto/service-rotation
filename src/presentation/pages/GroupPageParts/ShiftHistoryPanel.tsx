import { useEffect, useRef, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    Heading,
    IconButton,
    NumberInput,
    Portal,
    Switch,
    Table,
    Text,
    Textarea,
    VStack
} from '@chakra-ui/react'
import { MdInfoOutline } from 'react-icons/md'
import { CurrentUser, GroupEntity, ShiftHistoryProposalEntity, UserId } from '@domain'
import { MAX_MANUAL_SHIFT_HISTORY } from '@application'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const PROPOSAL_STATUS_LABELS: Record<ShiftHistoryProposalEntity['status'], string> = {
    pending: 'proposition en attente',
    accepted: 'proposition acceptée',
    rejected: 'proposition refusée'
}

const AUTOSAVE_DELAY_MS = 300

interface ShiftHistoryPanelProps {
    group: GroupEntity
    isCreator: boolean
    currentUser: CurrentUser
}

// Editable grid (creator) or read-only mirror (every other member) of
// Group.shiftHistory: organizer-owned, public to the whole group from the
// moment it's entered, frozen once voting opens. Deliberately not a
// member's own self-reported field — see README's honesty argument. Only
// rendered while the group is a draft; GradeSheetForm/LiveResultView carry
// the open-phase equivalents once it's frozen.
export function ShiftHistoryPanel({ group, isCreator, currentUser }: ShiftHistoryPanelProps) {
    const {
        updateGroupSettingsUseCase,
        setMemberShiftHistoryUseCase,
        importShiftHistoryUseCase,
        getGroupUseCase,
        getShiftHistoryProposalsUseCase,
        proposeShiftHistoryChangeUseCase,
        resolveShiftHistoryProposalUseCase
    } = useDependencies()

    const [enabled, setEnabled] = useState(group.pastShiftsEnabled)
    const [error, setError] = useState<string | null>(null)

    // Every current member's proposal (pending or resolved), keyed by uid —
    // the resolution trail is public to the whole group, not just the
    // proposer and the creator. Reloaded after any propose/resolve action
    // rather than kept in sync incrementally: this panel only shows while
    // the group is a draft, where such edits are already infrequent,
    // one-at-a-time actions.
    const [proposals, setProposals] = useState<Map<string, ShiftHistoryProposalEntity>>(new Map())

    function reloadProposals() {
        getShiftHistoryProposalsUseCase
            .execute({ groupId: group.id })
            .then(result => setProposals(new Map(result.proposals.map(p => [p.userId.value, p]))))
            .catch(() => {
                // Best-effort — the grid/inbox below still works without it.
            })
    }

    useEffect(reloadProposals, [group.id, getShiftHistoryProposalsUseCase])

    const [predecessorName, setPredecessorName] = useState<string | null>(null)
    const [importEnabled, setImportEnabled] = useState(group.importPastShiftsFromPredecessor)
    const [importing, setImporting] = useState(false)
    const [stillMissingMemberIds, setStillMissingMemberIds] = useState<string[]>([])

    // Best-effort label for the import switch — a missing/unreadable
    // predecessor just means it reads "le groupe précédent" instead of its
    // name, not an error worth surfacing here.
    useEffect(() => {
        if (!group.predecessorGroupId) return
        getGroupUseCase
            .execute({ groupId: group.predecessorGroupId })
            .then(result => setPredecessorName(result.group?.name ?? null))
            .catch(() => setPredecessorName(null))
    }, [group.predecessorGroupId, getGroupUseCase])

    const members = group.getMembers()
    const services = group.getServices()

    // Local editable buffer for the creator only — same reason DraftAdminView
    // doesn't resync services/rotation slots from a save response: it would
    // clobber a keystroke still in flight elsewhere in the grid. A read-only
    // viewer has nothing in flight to protect, so their cells read straight
    // from `group` below instead, and stay live as the group prop updates.
    const [counts, setCounts] = useState<Map<string, number>>(() => {
        const initial = new Map<string, number>()
        for (const member of members) {
            const row = group.getShiftHistoryFor(member.userId)
            for (const service of services) {
                initial.set(
                    `${member.userId.value}:${service.id.value}`,
                    row.get(service.id.value) ?? 0
                )
            }
        }
        return initial
    })
    const rowTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

    async function changeEnabled(value: boolean) {
        setEnabled(value)
        setError(null)
        try {
            await updateGroupSettingsUseCase.execute({
                groupId: group.id,
                pastShiftsEnabled: value
            })
        } catch (err) {
            setError(errorMessageFrom(err))
        }
    }

    async function changeImportEnabled(value: boolean) {
        setImportEnabled(value)
        setError(null)
        try {
            await updateGroupSettingsUseCase.execute({
                groupId: group.id,
                importPastShiftsFromPredecessor: value
            })
        } catch (err) {
            setError(errorMessageFrom(err))
        }
    }

    const missingMemberIds = members
        .filter(member => !group.shiftHistory.has(member.userId.value))
        .map(member => member.userId.value)
    const missingKey = missingMemberIds.slice().sort().join(',')

    // Auto-fills shiftHistory for whichever current members don't have a row
    // yet — on mount (page load/reload) and again whenever the missing set
    // actually changes (a member joins, or the switch is turned on). Never
    // touches a uid that already has a row, whether from a manual edit, an
    // accepted proposal, or a previous run of this same effect — see
    // ImportShiftHistoryUseCase. The ref latches on the exact missing-uid
    // set (not just an "already ran once" boolean, unlike OpenView's
    // done-transition effect) because the save this triggers only reaches
    // `group` after a Firestore round-trip: without latching on the set
    // itself, the render right after a successful fill (counts/state
    // updated locally, but `group.shiftHistory` not caught up yet) would
    // see the same uids as still missing and re-fire immediately.
    const autoImportAttemptedRef = useRef<string | null>(null)

    useEffect(() => {
        if (!isCreator || group.status !== 'draft' || !importEnabled || !group.predecessorGroupId) {
            return
        }
        if (missingKey === '' || autoImportAttemptedRef.current === missingKey) {
            return
        }
        autoImportAttemptedRef.current = missingKey
        setImporting(true)
        setError(null)
        importShiftHistoryUseCase
            .execute({ groupId: group.id })
            .then(result => {
                setCounts(previous => {
                    const next = new Map(previous)
                    for (const uid of missingMemberIds) {
                        const row = result.group.getShiftHistoryFor(UserId.from(uid))
                        for (const service of services) {
                            next.set(`${uid}:${service.id.value}`, row.get(service.id.value) ?? 0)
                        }
                    }
                    return next
                })
                setStillMissingMemberIds(result.stillMissingMemberIds)
            })
            .catch(err => setError(errorMessageFrom(err)))
            .finally(() => setImporting(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreator, group.status, group.id, group.predecessorGroupId, importEnabled, missingKey])

    const [proposeOpen, setProposeOpen] = useState(false)
    const [proposeCounts, setProposeCounts] = useState<Map<string, number>>(new Map())
    const [proposeJustification, setProposeJustification] = useState('')
    const [proposing, setProposing] = useState(false)
    const [resolvingUserId, setResolvingUserId] = useState<string | null>(null)
    const [viewingProposalUid, setViewingProposalUid] = useState<string | null>(null)

    function openProposeDialog() {
        const own = group.getShiftHistoryFor(currentUser.id)
        setProposeCounts(
            new Map(services.map(service => [service.id.value, own.get(service.id.value) ?? 0]))
        )
        setProposeJustification('')
        setProposeOpen(true)
    }

    async function submitProposal() {
        setProposing(true)
        setError(null)
        try {
            await proposeShiftHistoryChangeUseCase.execute({
                groupId: group.id,
                counts: proposeCounts,
                justification: proposeJustification.trim() || null
            })
            setProposeOpen(false)
            reloadProposals()
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setProposing(false)
        }
    }

    async function resolveProposal(userId: string, decision: 'accepted' | 'rejected') {
        setResolvingUserId(userId)
        setError(null)
        try {
            const result = await resolveShiftHistoryProposalUseCase.execute({
                groupId: group.id,
                userId: UserId.from(userId),
                decision
            })
            if (decision === 'accepted') {
                const row = result.group.getShiftHistoryFor(UserId.from(userId))
                setCounts(previous => {
                    const next = new Map(previous)
                    for (const service of services) {
                        next.set(`${userId}:${service.id.value}`, row.get(service.id.value) ?? 0)
                    }
                    return next
                })
            }
            reloadProposals()
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setResolvingUserId(null)
        }
    }

    function setCount(uid: string, serviceId: string, value: number) {
        setCounts(previous => {
            const next = new Map(previous)
            next.set(`${uid}:${serviceId}`, value)

            clearTimeout(rowTimers.current[uid])
            rowTimers.current[uid] = setTimeout(() => {
                const row = new Map<string, number>()
                for (const service of services) {
                    row.set(service.id.value, next.get(`${uid}:${service.id.value}`) ?? 0)
                }
                setMemberShiftHistoryUseCase
                    .execute({ groupId: group.id, userId: UserId.from(uid), counts: row })
                    .catch(err => setError(errorMessageFrom(err)))
            }, AUTOSAVE_DELAY_MS)

            return next
        })
    }

    function valueFor(uid: string, serviceId: string): number {
        if (isCreator) {
            return counts.get(`${uid}:${serviceId}`) ?? 0
        }
        return group.getShiftHistoryFor(UserId.from(uid)).get(serviceId) ?? 0
    }

    // A member with the feature off has nothing to see; the creator always
    // sees at least the toggle, to turn it on.
    if (!isCreator && !group.pastShiftsEnabled) {
        return null
    }

    const showGrid = isCreator ? enabled : group.pastShiftsEnabled

    return (
        <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
            <Heading size="sm" mb={2}>
                Stages déjà faits
            </Heading>
            <Text fontSize="sm" colorPalette="gray" mb={4}>
                Nombre de stages déjà faits dans chaque service avant ce cycle, pour chaque membre
                encore présent — renseigné par la personne ayant créé le groupe, visible par tout le
                monde dès sa saisie, et figé à l'activation de la notation.
            </Text>

            {isCreator && (
                <Switch.Root
                    checked={enabled}
                    onCheckedChange={details => changeEnabled(details.checked)}
                    mb={showGrid ? 4 : 0}
                >
                    <Switch.HiddenInput />
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Label>Suivre l'historique des stages déjà faits</Switch.Label>
                </Switch.Root>
            )}

            {isCreator && showGrid && group.predecessorGroupId && (
                <Box mb={4}>
                    <Switch.Root
                        checked={importEnabled}
                        onCheckedChange={details => changeImportEnabled(details.checked)}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Label>
                            Importer depuis {predecessorName ?? 'le groupe précédent'}
                            {importing ? '…' : ''}
                        </Switch.Label>
                    </Switch.Root>
                    {importEnabled && stillMissingMemberIds.length > 0 && (
                        <Text fontSize="xs" colorPalette="gray" mt={1}>
                            {stillMissingMemberIds.length} membre
                            {stillMissingMemberIds.length > 1 ? 's' : ''} sans correspondance (
                            {stillMissingMemberIds
                                .map(
                                    uid =>
                                        members.find(m => m.userId.value === uid)?.displayName ??
                                        uid
                                )
                                .join(', ')}
                            ) — laissé{stillMissingMemberIds.length > 1 ? 's' : ''} à 0, nouvel
                            essai automatique à la prochaine visite.
                        </Text>
                    )}
                </Box>
            )}

            {isCreator && showGrid && (
                <Box mb={4}>
                    {[...proposals.values()]
                        .filter(p => p.status === 'pending')
                        .map(p => (
                            <Box
                                key={p.userId.value}
                                borderWidth="1px"
                                borderRadius="md"
                                p={3}
                                mb={2}
                            >
                                <Text fontSize="sm" fontWeight="medium">
                                    {members.find(m => m.userId.equals(p.userId))?.displayName ??
                                        p.userId.value}{' '}
                                    propose une correction
                                </Text>
                                <Text fontSize="xs" colorPalette="gray" mb={2}>
                                    {services
                                        .map(
                                            service =>
                                                `${service.name}: ${p.counts.get(service.id.value) ?? 0}`
                                        )
                                        .join(' · ')}
                                    {p.justification ? ` — « ${p.justification} »` : ''}
                                </Text>
                                <Button
                                    size="xs"
                                    colorPalette="green"
                                    mr={2}
                                    loading={resolvingUserId === p.userId.value}
                                    onClick={() => resolveProposal(p.userId.value, 'accepted')}
                                >
                                    Accepter
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    loading={resolvingUserId === p.userId.value}
                                    onClick={() => resolveProposal(p.userId.value, 'rejected')}
                                >
                                    Refuser
                                </Button>
                            </Box>
                        ))}
                </Box>
            )}

            {!isCreator && showGrid && (
                <Box mb={4}>
                    <Button size="sm" variant="outline" onClick={openProposeDialog}>
                        Proposer une correction pour mes stages
                    </Button>
                    {proposals.get(currentUser.id.value) && (
                        <Text fontSize="xs" colorPalette="gray" mt={1}>
                            {PROPOSAL_STATUS_LABELS[proposals.get(currentUser.id.value)!.status]}
                        </Text>
                    )}
                </Box>
            )}

            <ErrorMessage message={error} />

            {showGrid &&
                (members.length === 0 || services.length === 0 ? (
                    <Text colorPalette="gray" fontSize="sm">
                        Ajoute des services et attends que des membres rejoignent le groupe pour
                        renseigner l'historique.
                    </Text>
                ) : (
                    <Box overflowX="auto">
                        <Table.Root size="sm">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader>Membre</Table.ColumnHeader>
                                    {services.map(service => (
                                        <Table.ColumnHeader key={service.id.value}>
                                            {service.name || '(sans nom)'}
                                        </Table.ColumnHeader>
                                    ))}
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {members.map(member => {
                                    const isMe = member.userId.equals(currentUser.id)
                                    return (
                                        <Table.Row key={member.userId.value}>
                                            <Table.Cell fontWeight={isMe ? 'bold' : 'medium'}>
                                                {member.displayName}
                                                {proposals.get(member.userId.value) && (
                                                    <Text
                                                        as="span"
                                                        fontSize="xs"
                                                        colorPalette="gray"
                                                        fontWeight="normal"
                                                    >
                                                        {' '}
                                                        (
                                                        {
                                                            PROPOSAL_STATUS_LABELS[
                                                                proposals.get(member.userId.value)!
                                                                    .status
                                                            ]
                                                        }
                                                        )
                                                    </Text>
                                                )}
                                                {proposals.get(member.userId.value)?.status ===
                                                    'accepted' && (
                                                    <IconButton
                                                        aria-label="Voir la correction acceptée"
                                                        size="2xs"
                                                        variant="ghost"
                                                        ml={1}
                                                        onClick={() =>
                                                            setViewingProposalUid(
                                                                member.userId.value
                                                            )
                                                        }
                                                    >
                                                        <MdInfoOutline />
                                                    </IconButton>
                                                )}
                                            </Table.Cell>
                                            {services.map(service => {
                                                const value = valueFor(
                                                    member.userId.value,
                                                    service.id.value
                                                )
                                                return (
                                                    <Table.Cell key={service.id.value}>
                                                        {isCreator ? (
                                                            <NumberInput.Root
                                                                size="sm"
                                                                w="90px"
                                                                min={0}
                                                                max={MAX_MANUAL_SHIFT_HISTORY}
                                                                value={String(value)}
                                                                onValueChange={details =>
                                                                    setCount(
                                                                        member.userId.value,
                                                                        service.id.value,
                                                                        Number(details.value) || 0
                                                                    )
                                                                }
                                                            >
                                                                <NumberInput.Input />
                                                            </NumberInput.Root>
                                                        ) : (
                                                            <Text
                                                                fontWeight={
                                                                    isMe ? 'bold' : undefined
                                                                }
                                                            >
                                                                {value}
                                                            </Text>
                                                        )}
                                                    </Table.Cell>
                                                )
                                            })}
                                        </Table.Row>
                                    )
                                })}
                            </Table.Body>
                        </Table.Root>
                    </Box>
                ))}

            <Dialog.Root open={proposeOpen} onOpenChange={details => setProposeOpen(details.open)}>
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>Proposer une correction</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <VStack gap={3} align="stretch">
                                    {services.map(service => (
                                        <Box key={service.id.value}>
                                            <Text fontSize="sm" mb={1}>
                                                {service.name || '(sans nom)'}
                                            </Text>
                                            <NumberInput.Root
                                                size="sm"
                                                min={0}
                                                max={MAX_MANUAL_SHIFT_HISTORY}
                                                value={String(
                                                    proposeCounts.get(service.id.value) ?? 0
                                                )}
                                                onValueChange={details =>
                                                    setProposeCounts(previous => {
                                                        const next = new Map(previous)
                                                        next.set(
                                                            service.id.value,
                                                            Number(details.value) || 0
                                                        )
                                                        return next
                                                    })
                                                }
                                            >
                                                <NumberInput.Input />
                                            </NumberInput.Root>
                                        </Box>
                                    ))}
                                    <Box>
                                        <Text fontSize="sm" mb={1}>
                                            Justification (optionnel)
                                        </Text>
                                        <Textarea
                                            value={proposeJustification}
                                            onChange={event =>
                                                setProposeJustification(event.target.value)
                                            }
                                            size="sm"
                                        />
                                    </Box>
                                </VStack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="outline" onClick={() => setProposeOpen(false)}>
                                    Annuler
                                </Button>
                                <Button
                                    colorPalette="blue"
                                    loading={proposing}
                                    onClick={submitProposal}
                                >
                                    Envoyer
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            <Dialog.Root
                open={viewingProposalUid !== null}
                onOpenChange={details => !details.open && setViewingProposalUid(null)}
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>Correction acceptée</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                {viewingProposalUid &&
                                    (() => {
                                        const proposal = proposals.get(viewingProposalUid)
                                        if (!proposal) return null
                                        return (
                                            <VStack gap={2} align="stretch">
                                                {services.map(service => (
                                                    <Text key={service.id.value} fontSize="sm">
                                                        {service.name || '(sans nom)'} :{' '}
                                                        {proposal.counts.get(service.id.value) ?? 0}
                                                    </Text>
                                                ))}
                                                {proposal.justification && (
                                                    <Text
                                                        fontSize="sm"
                                                        colorPalette="gray"
                                                        fontStyle="italic"
                                                    >
                                                        « {proposal.justification} »
                                                    </Text>
                                                )}
                                            </VStack>
                                        )
                                    })()}
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button onClick={() => setViewingProposalUid(null)}>Fermer</Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </Box>
    )
}
