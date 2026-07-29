import { useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, Heading, HStack, Portal, Text, VStack } from '@chakra-ui/react'
import { GradeLevel, GroupEntity, VoteEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const GRADE_OPTIONS: { level: GradeLevel; label: string }[] = [
    { level: GradeLevel.Excellent, label: 'Excellent' },
    { level: GradeLevel.Bien, label: 'Bien' },
    { level: GradeLevel.Indifferent, label: 'Indifférent' },
    { level: GradeLevel.Passable, label: 'Passable' }
]

const AUTOSAVE_DELAY_MS = 600

interface GradeSheetFormProps {
    group: GroupEntity
    existingVote: VoteEntity | null
    onChanged: () => void
}

// Freely re-editable (grades autosave, debounced, as you change them) until
// you lock the vote — a separate, deliberate, irreversible action confirmed
// through a dialog rather than a native alert. There is no cap on any grade
// any more: every service is assignable, nothing is a veto.
export function GradeSheetForm({ group, existingVote, onChanged }: GradeSheetFormProps) {
    const { saveVoteDraftUseCase, lockVoteUseCase } = useDependencies()
    const services = group.getServices()

    const [grades, setGrades] = useState<Map<string, GradeLevel>>(() => {
        if (existingVote) {
            return new Map(
                services.map(service => [
                    service.id.value,
                    existingVote.gradeFor(service.id)?.level ?? GradeLevel.Bien
                ])
            )
        }
        return new Map(services.map(service => [service.id.value, GradeLevel.Bien]))
    })
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
    const [locking, setLocking] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const skipNextSave = useRef(true)

    function setGrade(serviceId: string, level: GradeLevel) {
        setGrades(previous => new Map(previous).set(serviceId, level))
    }

    // Debounced autosave: skips the initial mount (grades already match
    // existingVote then, nothing to save) and coalesces rapid changes into
    // a single write instead of one per selection.
    useEffect(() => {
        if (skipNextSave.current) {
            skipNextSave.current = false
            return
        }
        setSaveState('saving')
        const timeout = setTimeout(() => {
            saveVoteDraftUseCase
                .execute({ groupId: group.id, grades })
                .then(() => {
                    setSaveState('saved')
                    onChanged()
                })
                .catch(err => {
                    setError(errorMessageFrom(err))
                    setSaveState('idle')
                })
        }, AUTOSAVE_DELAY_MS)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grades])

    async function confirmLock() {
        setConfirmOpen(false)
        setLocking(true)
        setError(null)
        try {
            await lockVoteUseCase.execute({ groupId: group.id })
            onChanged()
        } catch (err) {
            setError(errorMessageFrom(err))
        } finally {
            setLocking(false)
        }
    }

    return (
        <VStack gap={5} align="stretch">
            <Box>
                <Heading size="md">Notez chaque service</Heading>
                <Text fontSize="sm" colorPalette="gray" mt={1}>
                    Notez chaque service honnêtement : votre note n'influence que votre propre
                    affectation, jamais celle des autres. Votre brouillon est enregistré
                    automatiquement ; verrouillez votre vote une fois prêt.
                </Text>
            </Box>

            <VStack gap={3} align="stretch">
                {services.map(service => (
                    <HStack
                        key={service.id.value}
                        justify="space-between"
                        borderWidth="1px"
                        borderRadius="md"
                        p={3}
                        gap={4}
                    >
                        <Box>
                            <Text fontWeight="medium">{service.name}</Text>
                            {service.description && (
                                <Text fontSize="sm" colorPalette="gray">
                                    {service.description}
                                </Text>
                            )}
                        </Box>
                        <select
                            value={grades.get(service.id.value)}
                            onChange={event =>
                                setGrade(service.id.value, Number(event.target.value) as GradeLevel)
                            }
                            style={{ borderWidth: 1, borderRadius: 6, padding: 8, flexShrink: 0 }}
                        >
                            {GRADE_OPTIONS.map(option => (
                                <option key={option.level} value={option.level}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </HStack>
                ))}
            </VStack>

            <ErrorMessage message={error} />

            <HStack justify="space-between">
                <Text fontSize="xs" colorPalette="gray">
                    {saveState === 'saving'
                        ? 'Enregistrement du brouillon…'
                        : saveState === 'saved'
                          ? 'Brouillon enregistré.'
                          : ' '}
                </Text>
                <Button colorPalette="blue" loading={locking} onClick={() => setConfirmOpen(true)}>
                    Verrouiller mon vote
                </Button>
            </HStack>
            <Text fontSize="xs" colorPalette="gray">
                Une fois verrouillé, votre vote ne peut plus être modifié. Vous pourrez alors voir
                le vote des autres membres ayant eux-mêmes verrouillé le leur — et eux le vôtre.
            </Text>

            <Dialog.Root
                open={confirmOpen}
                onOpenChange={details => setConfirmOpen(details.open)}
                role="alertdialog"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>Verrouiller votre vote ?</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Text>
                                    Cette action est définitive : vous ne pourrez plus modifier vos
                                    notes ensuite.
                                </Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                                    Annuler
                                </Button>
                                <Button colorPalette="blue" onClick={confirmLock}>
                                    Verrouiller définitivement
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </VStack>
    )
}
