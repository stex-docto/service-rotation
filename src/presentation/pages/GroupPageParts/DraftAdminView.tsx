import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    DatePicker,
    Dialog,
    Field,
    Heading,
    HStack,
    IconButton,
    Input,
    InputGroup,
    NumberInput,
    Portal,
    Spinner,
    Switch,
    Text,
    VStack
} from '@chakra-ui/react'
import { parseDate } from '@internationalized/date'
import { MdAdd, MdCheck, MdDateRange, MdDelete } from 'react-icons/md'
import {
    CurrentUser,
    GroupEntity,
    RotationMode,
    RotationSlot,
    ServiceEntity,
    ServiceId
} from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'
import { MembershipPanel } from './MembershipPanel'
import { ShiftHistoryPanel } from './ShiftHistoryPanel'

const AUTOSAVE_DELAY_MS = 300

interface ServiceRowProps {
    service: ServiceEntity
    onChange: (
        serviceId: string,
        changes: { name?: string; description?: string; capacity?: number }
    ) => void
    onRemove: (serviceId: string) => void
}

// Memoized so typing in one service's field doesn't re-render every other
// service row — without this, every keystroke anywhere on the page re-runs
// this whole list (and the rotation slots' date pickers below).
const ServiceRow = memo(function ServiceRow({ service, onChange, onRemove }: ServiceRowProps) {
    return (
        <HStack gap={3} align="flex-end" borderWidth="1px" borderRadius="md" p={3} flexWrap="wrap">
            <Field.Root flex="2" minW="150px">
                <Field.Label>Nom</Field.Label>
                <Input
                    value={service.name}
                    onChange={event => onChange(service.id.value, { name: event.target.value })}
                />
            </Field.Root>
            <Field.Root flex="2" minW="150px">
                <Field.Label>Description</Field.Label>
                <Input
                    value={service.description}
                    onChange={event =>
                        onChange(service.id.value, { description: event.target.value })
                    }
                />
            </Field.Root>
            <Field.Root flex="1" minW="100px">
                <Field.Label>Places</Field.Label>
                <NumberInput.Root
                    value={String(service.capacity)}
                    onValueChange={details =>
                        onChange(service.id.value, { capacity: Number(details.value) })
                    }
                    min={1}
                >
                    <NumberInput.Input />
                    <NumberInput.Control />
                </NumberInput.Root>
            </Field.Root>
            <IconButton
                aria-label="Supprimer"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => onRemove(service.id.value)}
            >
                <MdDelete />
            </IconButton>
        </HStack>
    )
})

interface RotationSlotRowProps {
    index: number
    slot: RotationSlot
    rotationMode: RotationMode
    onChange: (index: number, changes: Partial<RotationSlot>) => void
    onRemove: (index: number) => void
}

// Memoized for the same reason as ServiceRow above. The date picker's value
// array is additionally memoized on this slot's own dates so a re-render
// triggered by something unrelated (typing in a different row, elsewhere on
// the page) doesn't hand it a freshly-allocated array on every keystroke.
const RotationSlotRow = memo(function RotationSlotRow({
    index,
    slot,
    rotationMode,
    onChange,
    onRemove
}: RotationSlotRowProps) {
    const dateValue = useMemo(
        () =>
            [slot.startDate, slot.endDate]
                .filter((value): value is string => value !== null)
                .map(value => parseDate(value)),
        [slot.startDate, slot.endDate]
    )

    return (
        <HStack gap={3} align="flex-end" borderWidth="1px" borderRadius="md" p={3} flexWrap="wrap">
            <Text minW="70px" fontSize="sm" fontWeight="medium">
                #{index + 1}
            </Text>
            {rotationMode === 'name' ? (
                <Field.Root flex="1" minW="150px">
                    <Field.Label>Nom</Field.Label>
                    <Input
                        value={slot.name ?? ''}
                        placeholder={`Rotation ${index + 1}`}
                        onChange={event => onChange(index, { name: event.target.value })}
                    />
                </Field.Root>
            ) : (
                <DatePicker.Root
                    flex="1"
                    minW="220px"
                    locale="fr-FR"
                    selectionMode="range"
                    value={dateValue}
                    onValueChange={details =>
                        // details.value are CalendarDate objects — .toString()
                        // is ISO 8601, unlike valueAsString, which is locale-
                        // formatted display text (e.g. "07/22/2026" for
                        // en-US) and isn't valid input for parseDate above.
                        onChange(index, {
                            startDate: details.value[0]?.toString() ?? null,
                            endDate: details.value[1]?.toString() ?? null
                        })
                    }
                >
                    <DatePicker.Label>Période</DatePicker.Label>
                    <DatePicker.Control>
                        <DatePicker.Input index={0} />
                        <DatePicker.Input index={1} />
                        <DatePicker.IndicatorGroup>
                            <DatePicker.Trigger>
                                <MdDateRange />
                            </DatePicker.Trigger>
                        </DatePicker.IndicatorGroup>
                    </DatePicker.Control>
                    <Portal>
                        <DatePicker.Positioner>
                            <DatePicker.Content>
                                <DatePicker.View view="day">
                                    <DatePicker.Header />
                                    <DatePicker.DayTable />
                                </DatePicker.View>
                                <DatePicker.View view="month">
                                    <DatePicker.Header />
                                    <DatePicker.MonthTable />
                                </DatePicker.View>
                                <DatePicker.View view="year">
                                    <DatePicker.Header />
                                    <DatePicker.YearTable />
                                </DatePicker.View>
                            </DatePicker.Content>
                        </DatePicker.Positioner>
                    </Portal>
                </DatePicker.Root>
            )}
            <IconButton
                aria-label="Supprimer"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => onRemove(index)}
            >
                <MdDelete />
            </IconButton>
        </HStack>
    )
})

interface DraftAdminViewProps {
    group: GroupEntity
    isCreator: boolean
    currentUser: CurrentUser
}

export function DraftAdminView({ group, isCreator, currentUser }: DraftAdminViewProps) {
    const {
        updateGroupSettingsUseCase,
        addServiceUseCase,
        updateServiceUseCase,
        removeServiceUseCase,
        addRotationSlotUseCase,
        removeRotationSlotUseCase,
        updateRotationSlotUseCase,
        setRotationModeUseCase,
        openGroupUseCase,
        deleteGroupUseCase
    } = useDependencies()
    const navigate = useNavigate()

    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Mirrors firestore.rules' delete clause: deletable only while nobody
    // but the creator has joined — the creator is always a member from
    // creation on (see CreateGroupUseCase), so this is never true just
    // because the list "looks empty".
    const otherMembers = group.getMembers().filter(member => !member.userId.equals(currentUser.id))
    const canDeleteGroup = otherMembers.length === 0
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    async function confirmDelete() {
        setDeleting(true)
        setError(null)
        try {
            await deleteGroupUseCase.execute({ groupId: group.id })
            navigate('/')
        } catch (err) {
            setError(errorMessageFrom(err))
            setDeleting(false)
        }
    }

    const [name, setName] = useState(group.name)
    const [nameSaveState, setNameSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
    const skipFirstNameSave = useRef(true)

    // Editable up to the moment the group opens — like the rotation slots
    // below, each existing service autosaves on its own debounce, keyed by
    // id (stable across removes) rather than array position.
    const [services, setServices] = useState<ServiceEntity[]>(group.getServices())
    const serviceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

    // Local buffer so typing doesn't fire a write per keystroke — each
    // rotation slot autosaves on its own debounce, same idea as the name
    // field below. Add/remove/mode-switch are immediate, single-click
    // actions instead, mirroring how services are added/removed.
    const [rotationSlots, setRotationSlots] = useState<RotationSlot[]>(group.rotationSlots)
    const rotationSlotTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

    const [allowRepeatedServices, setAllowRepeatedServices] = useState(group.allowRepeatedServices)
    // True once there are fewer services than rotations and repeats aren't
    // allowed to fill the gap — the group can't open like this (see
    // Group.open), so the creator needs to add a service, remove a rotation,
    // or flip the switch above.
    const servicesShortfall =
        !allowRepeatedServices && rotationSlots.length > 0 && services.length < rotationSlots.length

    // Stable identity — plugged into the useCallback-wrapped mutators below
    // so ServiceRow/RotationSlotRow's memoization actually holds up.
    const run = useCallback(async (action: () => Promise<unknown>) => {
        setBusy(true)
        setError(null)
        try {
            await action()
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setBusy(false)
        }
    }, [])

    // Debounced autosave for the group name — skips the initial mount, since
    // it already matches what's stored.
    useEffect(() => {
        if (skipFirstNameSave.current) {
            skipFirstNameSave.current = false
            return
        }
        const trimmed = name.trim()
        if (!trimmed) {
            return
        }
        setNameSaveState('saving')
        const timeout = setTimeout(() => {
            updateGroupSettingsUseCase
                .execute({ groupId: group.id, name: trimmed })
                .then(() => setNameSaveState('saved'))
                .catch(err => {
                    setError(errorMessageFrom(err))
                    setNameSaveState('idle')
                })
        }, AUTOSAVE_DELAY_MS)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name])

    // Clears any pending autosave timers on unmount.
    useEffect(() => {
        const serviceTimersAtMount = serviceTimers.current
        const rotationTimersAtMount = rotationSlotTimers.current
        return () => {
            Object.values(serviceTimersAtMount).forEach(clearTimeout)
            Object.values(rotationTimersAtMount).forEach(clearTimeout)
        }
    }, [])

    // Mirrors addRotation below: create immediately with empty defaults,
    // then edit in place via the same inline fields as any other service —
    // no separate add form to keep in sync.
    async function addService() {
        await run(async () => {
            const result = await addServiceUseCase.execute({
                groupId: group.id,
                name: '',
                description: '',
                capacity: 1
            })
            // Merge in only the newly created service(s), rather than
            // replacing the whole array — a full replace from this response
            // would clobber a concurrent, still-unsaved edit typed into
            // another row while this request was in flight.
            setServices(previous => {
                const knownIds = new Set(previous.map(service => service.id.value))
                const added = result.group
                    .getServices()
                    .filter(service => !knownIds.has(service.id.value))
                return [...previous, ...added]
            })
        })
    }

    const removeService = useCallback(
        async (serviceId: string) => {
            clearTimeout(serviceTimers.current[serviceId])
            delete serviceTimers.current[serviceId]
            setServices(previous => previous.filter(service => service.id.value !== serviceId))
            // No resync after this resolves — same reason as changeService
            // above: the optimistic filter already applied, and replacing the
            // whole array from this response could clobber a concurrent edit
            // to a different row still in flight.
            await run(() =>
                removeServiceUseCase.execute({
                    groupId: group.id,
                    serviceId: ServiceId.from(serviceId)
                })
            )
        },
        [group.id, removeServiceUseCase, run]
    )

    const changeService = useCallback(
        (
            serviceId: string,
            changes: { name?: string; description?: string; capacity?: number }
        ) => {
            // Ignore a transiently invalid capacity (e.g. clearing the field to
            // retype it) rather than throwing out of a state updater.
            if (changes.capacity !== undefined && !(changes.capacity >= 1)) {
                return
            }

            setServices(previous => {
                const updated = previous.map(service =>
                    service.id.value === serviceId
                        ? service.update(changes.name, changes.description, changes.capacity)
                        : service
                )
                const service = updated.find(s => s.id.value === serviceId) as ServiceEntity

                clearTimeout(serviceTimers.current[serviceId])
                serviceTimers.current[serviceId] = setTimeout(() => {
                    // No setServices(result...) here — same reason as
                    // changeRotationSlot below: resyncing from the server
                    // response would clobber a newer keystroke typed while
                    // this save was still in flight. Local state is already
                    // correct; ServiceEntity.update() is pure and deterministic
                    // so there's nothing server-only to pick up.
                    run(() =>
                        updateServiceUseCase.execute({
                            groupId: group.id,
                            serviceId: service.id,
                            name: service.name,
                            description: service.description,
                            capacity: service.capacity
                        })
                    )
                }, AUTOSAVE_DELAY_MS)

                return updated
            })
        },
        [group.id, updateServiceUseCase, run]
    )

    async function addRotation() {
        setRotationSlots(previous => [...previous, { name: null, startDate: null, endDate: null }])
        await run(() => addRotationSlotUseCase.execute({ groupId: group.id }))
    }

    const removeRotation = useCallback(
        async (index: number) => {
            // Removing a slot shifts every later slot down one position, so
            // any pending timer keyed by its old index would otherwise fire
            // after the shift and write its slot's data under the wrong (or
            // no longer existing) index — clear all of them, not just this one.
            Object.values(rotationSlotTimers.current).forEach(clearTimeout)
            rotationSlotTimers.current = {}
            setRotationSlots(previous => previous.filter((_, i) => i !== index))
            await run(() => removeRotationSlotUseCase.execute({ groupId: group.id, index }))
        },
        [group.id, removeRotationSlotUseCase, run]
    )

    const changeRotationSlot = useCallback(
        (index: number, changes: Partial<RotationSlot>) => {
            setRotationSlots(previous => {
                const updated = previous.map((slot, i) =>
                    i === index ? { ...slot, ...changes } : slot
                )
                const slot = updated[index]

                clearTimeout(rotationSlotTimers.current[index])
                rotationSlotTimers.current[index] = setTimeout(() => {
                    run(() =>
                        updateRotationSlotUseCase.execute({
                            groupId: group.id,
                            index,
                            name: slot.name,
                            startDate: slot.startDate,
                            endDate: slot.endDate
                        })
                    )
                }, AUTOSAVE_DELAY_MS)

                return updated
            })
        },
        [group.id, updateRotationSlotUseCase, run]
    )

    async function changeRotationMode(mode: RotationMode) {
        await run(() => setRotationModeUseCase.execute({ groupId: group.id, mode }))
    }

    async function changeAllowRepeatedServices(value: boolean) {
        setAllowRepeatedServices(value)
        await run(() =>
            updateGroupSettingsUseCase.execute({ groupId: group.id, allowRepeatedServices: value })
        )
    }

    async function openGroup() {
        await run(() => openGroupUseCase.execute({ groupId: group.id }))
    }

    // Read-only mirror of the creator's Rotations/Services sections below —
    // a joined member can see what they'll be grading, but nothing here is
    // editable, and there's deliberately no add/remove/mode control.
    if (!isCreator) {
        return (
            <VStack gap={8} align="stretch">
                <Box>
                    <Heading size="lg">{group.name}</Heading>
                </Box>

                <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
                    <Heading size="sm" mb={2}>
                        Vote
                    </Heading>
                    <Text colorPalette="gray">
                        En attente que la personne ayant créé le groupe active la notation.
                    </Text>
                </Box>

                <MembershipPanel group={group} isCreator={false} currentUser={currentUser} />

                <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
                    <Heading size="sm" mb={4}>
                        Rotations ({group.rotationSlots.length})
                    </Heading>
                    <VStack gap={2} align="stretch">
                        {group.rotationSlots.map((slot, index) => (
                            <HStack
                                key={index}
                                justify="space-between"
                                borderWidth="1px"
                                borderRadius="md"
                                p={3}
                            >
                                <Text fontSize="sm" fontWeight="medium">
                                    #{index + 1}
                                </Text>
                                <Text fontSize="sm" colorPalette="gray">
                                    {group.rotationMode === 'name'
                                        ? slot.name || `Rotation ${index + 1}`
                                        : `${slot.startDate ?? '?'} → ${slot.endDate ?? '?'}`}
                                </Text>
                            </HStack>
                        ))}
                        {group.rotationSlots.length === 0 && (
                            <Text colorPalette="gray">Aucune rotation pour l'instant.</Text>
                        )}
                    </VStack>
                </Box>

                <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
                    <Heading size="sm" mb={4}>
                        Services ({group.getServices().length})
                    </Heading>
                    <VStack gap={2} align="stretch">
                        {group.getServices().map(service => (
                            <HStack
                                key={service.id.value}
                                justify="space-between"
                                borderWidth="1px"
                                borderRadius="md"
                                p={3}
                            >
                                <Box>
                                    <Text fontWeight="medium">{service.name || '(sans nom)'}</Text>
                                    {service.description && (
                                        <Text fontSize="sm" colorPalette="gray">
                                            {service.description}
                                        </Text>
                                    )}
                                </Box>
                                <Text fontSize="sm" colorPalette="gray">
                                    {service.capacity} place{service.capacity > 1 ? 's' : ''}
                                </Text>
                            </HStack>
                        ))}
                        {group.getServices().length === 0 && (
                            <Text colorPalette="gray">Aucun service pour l'instant.</Text>
                        )}
                    </VStack>
                </Box>

                <ShiftHistoryPanel group={group} isCreator={false} currentUser={currentUser} />
            </VStack>
        )
    }

    return (
        <VStack gap={8} align="stretch">
            <InputGroup
                endElement={
                    nameSaveState === 'saving' ? (
                        <Spinner size="xs" />
                    ) : nameSaveState === 'saved' ? (
                        <MdCheck color="green" />
                    ) : undefined
                }
            >
                <Input
                    aria-label="Nom du groupe"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    variant="flushed"
                    fontSize="2xl"
                    fontWeight="bold"
                    px={0}
                />
            </InputGroup>

            <MembershipPanel group={group} isCreator currentUser={currentUser} />

            <ErrorMessage message={error} />

            <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
                <HStack justify="space-between" mb={4}>
                    <Heading size="sm">Rotations ({rotationSlots.length})</Heading>
                    <HStack gap={2}>
                        <HStack gap={1}>
                            <Button
                                size="xs"
                                colorPalette="blue"
                                variant={group.rotationMode === 'name' ? 'solid' : 'outline'}
                                onClick={() => changeRotationMode('name')}
                            >
                                Nommées
                            </Button>
                            <Button
                                size="xs"
                                colorPalette="blue"
                                variant={group.rotationMode === 'date' ? 'solid' : 'outline'}
                                onClick={() => changeRotationMode('date')}
                            >
                                Datées
                            </Button>
                        </HStack>
                        <IconButton
                            aria-label="Ajouter une rotation"
                            title="Ajouter une rotation"
                            size="sm"
                            colorPalette="blue"
                            onClick={addRotation}
                            loading={busy}
                        >
                            <MdAdd />
                        </IconButton>
                    </HStack>
                </HStack>
                <VStack gap={2} align="stretch" mb={4}>
                    {rotationSlots.map((slot, index) => (
                        <RotationSlotRow
                            key={index}
                            index={index}
                            slot={slot}
                            rotationMode={group.rotationMode}
                            onChange={changeRotationSlot}
                            onRemove={removeRotation}
                        />
                    ))}
                    {rotationSlots.length === 0 && (
                        <Text colorPalette="gray">Aucune rotation pour l'instant.</Text>
                    )}
                </VStack>
            </Box>

            <Box borderWidth="1px" borderRadius="md" shadow="sm" p={4}>
                <HStack justify="space-between" mb={4}>
                    <Heading size="sm">Services ({services.length})</Heading>
                    <IconButton
                        aria-label="Ajouter un service"
                        title="Ajouter un service"
                        size="sm"
                        colorPalette="blue"
                        onClick={addService}
                        loading={busy}
                    >
                        <MdAdd />
                    </IconButton>
                </HStack>
                <VStack gap={2} align="stretch" mb={4}>
                    {services.map(service => (
                        <ServiceRow
                            key={service.id.value}
                            service={service}
                            onChange={changeService}
                            onRemove={removeService}
                        />
                    ))}
                    {services.length === 0 && (
                        <Text colorPalette="gray">Aucun service pour l'instant.</Text>
                    )}
                </VStack>

                <Switch.Root
                    checked={allowRepeatedServices}
                    onCheckedChange={details => changeAllowRepeatedServices(details.checked)}
                >
                    <Switch.HiddenInput />
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Label>Autoriser un même service sur plusieurs rotations</Switch.Label>
                </Switch.Root>
            </Box>

            <ShiftHistoryPanel group={group} isCreator currentUser={currentUser} />

            {servicesShortfall && (
                <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Pas assez de services pour couvrir les rotations</Alert.Title>
                        <Alert.Description>
                            Il y a {rotationSlots.length} rotation
                            {rotationSlots.length > 1 ? 's' : ''} mais seulement {services.length}{' '}
                            service{services.length > 1 ? 's' : ''}. Ajoutez un service, retirez une
                            rotation, ou autorisez la répétition d'un même service ci-dessus.
                        </Alert.Description>
                    </Alert.Content>
                </Alert.Root>
            )}

            <Box borderWidth="1px" borderColor="blue.300" borderRadius="md" shadow="sm" p={4}>
                <Heading size="sm" mb={2}>
                    Activer la notation
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={4}>
                    Une fois activé, les services et les rotations sont figés définitivement, et les
                    membres sont verrouillés définitivement (plus aucune nouvelle inscription, pour
                    l'équité entre membres). Les membres déjà inscrits peuvent commencer à noter.
                </Text>
                <Button
                    colorPalette="blue"
                    onClick={openGroup}
                    loading={busy}
                    disabled={
                        services.length === 0 || rotationSlots.length === 0 || servicesShortfall
                    }
                >
                    Activer la notation
                </Button>
            </Box>

            <Box borderWidth="1px" borderColor="red.300" borderRadius="md" shadow="sm" p={4}>
                <Heading size="sm" mb={2}>
                    Supprimer le groupe
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={4}>
                    {canDeleteGroup
                        ? 'Supprime définitivement ce groupe. Possible uniquement tant que personne d’autre que toi ne l’a rejoint.'
                        : `Impossible tant que d'autres membres (${otherMembers.length}) ont rejoint ce groupe.`}
                </Text>
                <Button
                    colorPalette="red"
                    variant="outline"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={!canDeleteGroup}
                >
                    Supprimer le groupe
                </Button>
            </Box>

            <Dialog.Root
                open={deleteConfirmOpen}
                onOpenChange={details => setDeleteConfirmOpen(details.open)}
                role="alertdialog"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>Supprimer « {group.name} » ?</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Text>
                                    Cette action est définitive : le groupe, ses services et ses
                                    rotations seront supprimés et ne pourront pas être récupérés.
                                </Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button
                                    variant="outline"
                                    onClick={() => setDeleteConfirmOpen(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    colorPalette="red"
                                    loading={deleting}
                                    onClick={confirmDelete}
                                >
                                    Supprimer définitivement
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </VStack>
    )
}
