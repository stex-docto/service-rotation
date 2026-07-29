import { FormEvent, useEffect, useRef, useState } from 'react'
import {
    Box,
    Button,
    Field,
    Heading,
    HStack,
    IconButton,
    Input,
    NumberInput,
    Separator,
    Text,
    VStack
} from '@chakra-ui/react'
import { MdDelete } from 'react-icons/md'
import { GroupEntity, RotationMode, RotationSlot, ServiceEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const AUTOSAVE_DELAY_MS = 600

interface DraftAdminViewProps {
    group: GroupEntity
}

export function DraftAdminView({ group }: DraftAdminViewProps) {
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

    const [serviceName, setServiceName] = useState('')
    const [serviceDescription, setServiceDescription] = useState('')
    const [serviceCapacity, setServiceCapacity] = useState('1')

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

    async function addService(event: FormEvent) {
        event.preventDefault()
        await run(async () => {
            const result = await addServiceUseCase.execute({
                groupId: group.id,
                name: serviceName.trim(),
                description: serviceDescription.trim(),
                capacity: Number(serviceCapacity)
            })
            setServices(result.group.getServices())
            setServiceName('')
            setServiceDescription('')
            setServiceCapacity('1')
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

    return (
        <VStack gap={8} align="stretch">
            <Box>
                <Heading size="lg">{group.name}</Heading>
                <Text colorPalette="gray">
                    Brouillon — visible seulement par vous tant que non ouvert.
                </Text>
            </Box>

            <ErrorMessage message={error} />

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    Paramètres
                </Heading>
                <VStack gap={2} align="stretch">
                    <Field.Root>
                        <Field.Label>Nom du groupe</Field.Label>
                        <Input value={name} onChange={event => setName(event.target.value)} />
                    </Field.Root>
                    <Text fontSize="xs" colorPalette="gray">
                        {nameSaveState === 'saving'
                            ? 'Enregistrement…'
                            : nameSaveState === 'saved'
                              ? 'Enregistré.'
                              : ' '}
                    </Text>
                </VStack>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <HStack justify="space-between" mb={4}>
                    <Heading size="sm">Rotations ({rotationSlots.length})</Heading>
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
                                <>
                                    <Field.Root flex="1" minW="150px">
                                        <Field.Label>Début</Field.Label>
                                        <Input
                                            type="date"
                                            value={slot.startDate ?? ''}
                                            onChange={event =>
                                                changeRotationSlot(index, {
                                                    startDate: event.target.value || null
                                                })
                                            }
                                        />
                                    </Field.Root>
                                    <Field.Root flex="1" minW="150px">
                                        <Field.Label>Fin</Field.Label>
                                        <Input
                                            type="date"
                                            value={slot.endDate ?? ''}
                                            onChange={event =>
                                                changeRotationSlot(index, {
                                                    endDate: event.target.value || null
                                                })
                                            }
                                        />
                                    </Field.Root>
                                </>
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
                <Button variant="outline" onClick={addRotation} loading={busy}>
                    Ajouter une rotation
                </Button>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    Services ({services.length})
                </Heading>
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
                                <Field.Label>Places / rotation</Field.Label>
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

                <Separator mb={4} />

                <HStack as="form" onSubmit={addService} gap={3} align="flex-end" flexWrap="wrap">
                    <Field.Root flex="2" minW="150px">
                        <Field.Label>Nom du service</Field.Label>
                        <Input
                            value={serviceName}
                            onChange={event => setServiceName(event.target.value)}
                            required
                        />
                    </Field.Root>
                    <Field.Root flex="2" minW="150px">
                        <Field.Label>Description</Field.Label>
                        <Input
                            value={serviceDescription}
                            onChange={event => setServiceDescription(event.target.value)}
                        />
                    </Field.Root>
                    <Field.Root flex="1" minW="100px">
                        <Field.Label>Places / rotation</Field.Label>
                        <NumberInput.Root
                            value={serviceCapacity}
                            onValueChange={details => setServiceCapacity(details.value)}
                            min={1}
                        >
                            <NumberInput.Input />
                            <NumberInput.Control />
                        </NumberInput.Root>
                    </Field.Root>
                    <Button type="submit" loading={busy}>
                        Ajouter
                    </Button>
                </HStack>
            </Box>

            <Box borderWidth="1px" borderColor="blue.300" borderRadius="md" p={4}>
                <Heading size="sm" mb={2}>
                    Ouvrir le groupe
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={4}>
                    Une fois ouvert, les services et les rotations sont figés définitivement.
                    Partagez ensuite le lien du groupe : chaque interne rejoint et vote lui-même,
                    sans inscription préalable.
                </Text>
                <Button
                    colorPalette="blue"
                    onClick={openGroup}
                    loading={busy}
                    disabled={services.length === 0 || rotationSlots.length === 0}
                >
                    Ouvrir le groupe
                </Button>
            </Box>
        </VStack>
    )
}
