import { useEffect, useRef, useState } from 'react'
import {
    Box,
    Button,
    DatePicker,
    Field,
    Heading,
    HStack,
    IconButton,
    Input,
    InputGroup,
    NumberInput,
    Portal,
    Spinner,
    Text,
    VStack
} from '@chakra-ui/react'
import { parseDate } from '@internationalized/date'
import { MdAdd, MdCheck, MdDateRange, MdDelete } from 'react-icons/md'
import { CurrentUser, GroupEntity, RotationMode, RotationSlot, ServiceEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'
import { MembershipPanel } from './MembershipPanel'

const AUTOSAVE_DELAY_MS = 600

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
        openGroupUseCase
    } = useDependencies()

    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

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

    async function run(action: () => Promise<unknown>) {
        setBusy(true)
        setError(null)
        try {
            await action()
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setBusy(false)
        }
    }

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
            setServices(result.group.getServices())
        })
    }

    async function removeService(serviceId: string) {
        clearTimeout(serviceTimers.current[serviceId])
        delete serviceTimers.current[serviceId]
        setServices(previous => previous.filter(service => service.id.value !== serviceId))
        await run(async () => {
            const result = await removeServiceUseCase.execute({
                groupId: group.id,
                serviceId: services.find(service => service.id.value === serviceId)!.id
            })
            setServices(result.group.getServices())
        })
    }

    function changeService(
        serviceId: string,
        changes: { name?: string; description?: string; capacity?: number }
    ) {
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
                run(async () => {
                    const result = await updateServiceUseCase.execute({
                        groupId: group.id,
                        serviceId: service.id,
                        name: service.name,
                        description: service.description,
                        capacity: service.capacity
                    })
                    setServices(result.group.getServices())
                })
            }, AUTOSAVE_DELAY_MS)

            return updated
        })
    }

    async function addRotation() {
        setRotationSlots(previous => [...previous, { name: null, startDate: null, endDate: null }])
        await run(() => addRotationSlotUseCase.execute({ groupId: group.id }))
    }

    async function removeRotation(index: number) {
        clearTimeout(rotationSlotTimers.current[index])
        delete rotationSlotTimers.current[index]
        setRotationSlots(previous => previous.filter((_, i) => i !== index))
        await run(() => removeRotationSlotUseCase.execute({ groupId: group.id, index }))
    }

    function changeRotationSlot(index: number, changes: Partial<RotationSlot>) {
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
    }

    async function changeRotationMode(mode: RotationMode) {
        await run(() => setRotationModeUseCase.execute({ groupId: group.id, mode }))
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
                    <Text colorPalette="gray">
                        En attente que la personne ayant créé le groupe active le vote.
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
                                variant={group.rotationMode === 'name' ? 'solid' : 'outline'}
                                onClick={() => changeRotationMode('name')}
                            >
                                Nommées
                            </Button>
                            <Button
                                size="xs"
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
                            onClick={addRotation}
                            loading={busy}
                        >
                            <MdAdd />
                        </IconButton>
                    </HStack>
                </HStack>
                <VStack gap={2} align="stretch" mb={4}>
                    {rotationSlots.map((slot, index) => (
                        <HStack
                            key={index}
                            gap={3}
                            align="flex-end"
                            borderWidth="1px"
                            borderRadius="md"
                            p={3}
                            flexWrap="wrap"
                        >
                            <Text minW="70px" fontSize="sm" fontWeight="medium">
                                #{index + 1}
                            </Text>
                            {group.rotationMode === 'name' ? (
                                <Field.Root flex="1" minW="150px">
                                    <Field.Label>Nom</Field.Label>
                                    <Input
                                        value={slot.name ?? ''}
                                        placeholder={`Rotation ${index + 1}`}
                                        onChange={event =>
                                            changeRotationSlot(index, { name: event.target.value })
                                        }
                                    />
                                </Field.Root>
                            ) : (
                                <DatePicker.Root
                                    flex="1"
                                    minW="220px"
                                    locale="fr-FR"
                                    selectionMode="range"
                                    value={[slot.startDate, slot.endDate]
                                        .filter((value): value is string => value !== null)
                                        .map(value => parseDate(value))}
                                    onValueChange={details =>
                                        // details.value are CalendarDate objects — .toString()
                                        // is ISO 8601, unlike valueAsString, which is locale-
                                        // formatted display text (e.g. "07/22/2026" for
                                        // en-US) and isn't valid input for parseDate above.
                                        changeRotationSlot(index, {
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
                                onClick={() => removeRotation(index)}
                            >
                                <MdDelete />
                            </IconButton>
                        </HStack>
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
                        onClick={addService}
                        loading={busy}
                    >
                        <MdAdd />
                    </IconButton>
                </HStack>
                <VStack gap={2} align="stretch" mb={4}>
                    {services.map(service => (
                        <HStack
                            key={service.id.value}
                            gap={3}
                            align="flex-end"
                            borderWidth="1px"
                            borderRadius="md"
                            p={3}
                            flexWrap="wrap"
                        >
                            <Field.Root flex="2" minW="150px">
                                <Field.Label>Nom</Field.Label>
                                <Input
                                    value={service.name}
                                    onChange={event =>
                                        changeService(service.id.value, {
                                            name: event.target.value
                                        })
                                    }
                                />
                            </Field.Root>
                            <Field.Root flex="2" minW="150px">
                                <Field.Label>Description</Field.Label>
                                <Input
                                    value={service.description}
                                    onChange={event =>
                                        changeService(service.id.value, {
                                            description: event.target.value
                                        })
                                    }
                                />
                            </Field.Root>
                            <Field.Root flex="1" minW="100px">
                                <Field.Label>Places</Field.Label>
                                <NumberInput.Root
                                    value={String(service.capacity)}
                                    onValueChange={details =>
                                        changeService(service.id.value, {
                                            capacity: Number(details.value)
                                        })
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
                                onClick={() => removeService(service.id.value)}
                            >
                                <MdDelete />
                            </IconButton>
                        </HStack>
                    ))}
                    {services.length === 0 && (
                        <Text colorPalette="gray">Aucun service pour l'instant.</Text>
                    )}
                </VStack>
            </Box>

            <Box borderWidth="1px" borderColor="blue.300" borderRadius="md" shadow="sm" p={4}>
                <Heading size="sm" mb={2}>
                    Activer le vote
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={4}>
                    Une fois activé, les services et les rotations sont figés définitivement, et les
                    membres sont verrouillés définitivement (plus aucune nouvelle inscription, pour
                    l'équité entre membres). Les membres déjà inscrits peuvent commencer à voter.
                </Text>
                <Button
                    colorPalette="blue"
                    onClick={openGroup}
                    loading={busy}
                    disabled={services.length === 0 || rotationSlots.length === 0}
                >
                    Activer le vote
                </Button>
            </Box>
        </VStack>
    )
}
