import { FormEvent, useState } from 'react'
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
import { GroupEntity, ServiceId } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

interface DraftAdminViewProps {
    group: GroupEntity
}

export function DraftAdminView({ group }: DraftAdminViewProps) {
    const {
        updateGroupSettingsUseCase,
        addServiceUseCase,
        removeServiceUseCase,
        addRosterEntryUseCase,
        removeRosterEntryUseCase,
        openSubmissionsUseCase
    } = useDependencies()

    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const [name, setName] = useState(group.name)
    const [rotations, setRotations] = useState(String(group.rotations))
    const [maxRejections, setMaxRejections] = useState(
        group.maxRejections === null ? '' : String(group.maxRejections)
    )

    const [serviceName, setServiceName] = useState('')
    const [serviceDescription, setServiceDescription] = useState('')
    const [serviceCapacity, setServiceCapacity] = useState('1')

    const [rosterEmail, setRosterEmail] = useState('')
    const [rosterName, setRosterName] = useState('')

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

    async function saveSettings(event: FormEvent) {
        event.preventDefault()
        await run(() =>
            updateGroupSettingsUseCase.execute({
                groupId: group.id,
                name: name.trim(),
                rotations: Number(rotations),
                maxRejections: maxRejections === '' ? undefined : Number(maxRejections)
            })
        )
    }

    async function addService(event: FormEvent) {
        event.preventDefault()
        await run(async () => {
            await addServiceUseCase.execute({
                groupId: group.id,
                name: serviceName.trim(),
                description: serviceDescription.trim(),
                capacity: Number(serviceCapacity)
            })
            setServiceName('')
            setServiceDescription('')
            setServiceCapacity('1')
        })
    }

    async function addRosterEntry(event: FormEvent) {
        event.preventDefault()
        await run(async () => {
            await addRosterEntryUseCase.execute({
                groupId: group.id,
                email: rosterEmail.trim(),
                displayName: rosterName.trim()
            })
            setRosterEmail('')
            setRosterName('')
        })
    }

    async function openSubmissions() {
        await run(() => openSubmissionsUseCase.execute({ groupId: group.id }))
    }

    const services = group.getServices()
    const roster = group.getRoster()
    const suggestedMaxRejections = Math.max(0, services.length - group.rotations - 1)

    return (
        <VStack gap={8} align="stretch">
            <Box>
                <Heading size="lg">{group.name}</Heading>
                <Text colorPalette="gray">
                    Brouillon — visible seulement par vous tant que non ouvert.
                </Text>
            </Box>

            <ErrorMessage message={error} />

            <Box as="form" onSubmit={saveSettings} borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    Paramètres
                </Heading>
                <VStack gap={4} align="stretch">
                    <Field.Root>
                        <Field.Label>Nom du groupe</Field.Label>
                        <Input value={name} onChange={event => setName(event.target.value)} />
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>Nombre de rotations</Field.Label>
                        <NumberInput.Root
                            value={rotations}
                            onValueChange={details => setRotations(details.value)}
                            min={1}
                        >
                            <NumberInput.Input />
                            <NumberInput.Control />
                        </NumberInput.Root>
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>Nombre maximum de refus autorisés par interne</Field.Label>
                        <NumberInput.Root
                            value={maxRejections}
                            onValueChange={details => setMaxRejections(details.value)}
                            min={0}
                        >
                            <NumberInput.Input />
                            <NumberInput.Control />
                        </NumberInput.Root>
                        <Field.HelperText>
                            Suggestion pour {services.length} services et {group.rotations}{' '}
                            rotations : {suggestedMaxRejections}. Laisser vide pour appliquer cette
                            suggestion à l'ouverture.
                        </Field.HelperText>
                    </Field.Root>
                    <Button type="submit" alignSelf="flex-start" loading={busy}>
                        Enregistrer
                    </Button>
                </VStack>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    Services ({services.length})
                </Heading>
                <VStack gap={2} align="stretch" mb={4}>
                    {services.map(service => (
                        <HStack
                            key={service.id.value}
                            justify="space-between"
                            borderWidth="1px"
                            borderRadius="md"
                            p={3}
                        >
                            <Box>
                                <Text fontWeight="medium">{service.name}</Text>
                                <Text fontSize="sm" colorPalette="gray">
                                    {service.description || 'Aucune description'} —{' '}
                                    {service.capacity} place(s) par rotation
                                </Text>
                            </Box>
                            <IconButton
                                aria-label="Supprimer"
                                size="sm"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() =>
                                    run(() =>
                                        removeServiceUseCase.execute({
                                            groupId: group.id,
                                            serviceId: service.id as ServiceId
                                        })
                                    )
                                }
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

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    Internes ({roster.length})
                </Heading>
                <VStack gap={2} align="stretch" mb={4}>
                    {roster.map(entry => (
                        <HStack
                            key={entry.email.value}
                            justify="space-between"
                            borderWidth="1px"
                            borderRadius="md"
                            p={3}
                        >
                            <Box>
                                <Text fontWeight="medium">{entry.displayName}</Text>
                                <Text fontSize="sm" colorPalette="gray">
                                    {entry.email.value}
                                </Text>
                            </Box>
                            <IconButton
                                aria-label="Retirer"
                                size="sm"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() =>
                                    run(() =>
                                        removeRosterEntryUseCase.execute({
                                            groupId: group.id,
                                            email: entry.email.value
                                        })
                                    )
                                }
                            >
                                <MdDelete />
                            </IconButton>
                        </HStack>
                    ))}
                    {roster.length === 0 && (
                        <Text colorPalette="gray">Aucun interne ajouté pour l'instant.</Text>
                    )}
                </VStack>

                <Separator mb={4} />

                <HStack
                    as="form"
                    onSubmit={addRosterEntry}
                    gap={3}
                    align="flex-end"
                    flexWrap="wrap"
                >
                    <Field.Root flex="2" minW="150px">
                        <Field.Label>Nom</Field.Label>
                        <Input
                            value={rosterName}
                            onChange={event => setRosterName(event.target.value)}
                            required
                        />
                    </Field.Root>
                    <Field.Root flex="2" minW="200px">
                        <Field.Label>Email Google</Field.Label>
                        <Input
                            type="email"
                            value={rosterEmail}
                            onChange={event => setRosterEmail(event.target.value)}
                            required
                        />
                    </Field.Root>
                    <Button type="submit" loading={busy}>
                        Ajouter
                    </Button>
                </HStack>
            </Box>

            <Box borderWidth="1px" borderColor="blue.300" borderRadius="md" p={4}>
                <Heading size="sm" mb={2}>
                    Ouvrir les soumissions
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={4}>
                    Une fois ouvert, les services, la liste des internes et le tirage au sort de
                    départage sont figés définitivement. Partagez ensuite le lien du groupe à tous
                    les internes.
                </Text>
                <Button
                    colorPalette="blue"
                    onClick={openSubmissions}
                    loading={busy}
                    disabled={roster.length === 0 || services.length === 0}
                >
                    Ouvrir les soumissions
                </Button>
            </Box>
        </VStack>
    )
}
