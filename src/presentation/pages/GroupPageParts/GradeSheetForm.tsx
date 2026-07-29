import { FormEvent, useMemo, useState } from 'react'
import { Box, Button, Heading, HStack, Text, VStack } from '@chakra-ui/react'
import { GradeLevel, GroupEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const GRADE_OPTIONS: { level: GradeLevel; label: string }[] = [
    { level: GradeLevel.Excellent, label: 'Excellent' },
    { level: GradeLevel.TresBien, label: 'Très bien' },
    { level: GradeLevel.Bien, label: 'Bien' },
    { level: GradeLevel.Passable, label: 'Passable' },
    { level: GradeLevel.Insuffisant, label: 'Insuffisant' },
    { level: GradeLevel.ARejeter, label: 'À rejeter' }
]

interface GradeSheetFormProps {
    group: GroupEntity
    onSubmitted: () => void
}

export function GradeSheetForm({ group, onSubmitted }: GradeSheetFormProps) {
    const { submitGradesUseCase } = useDependencies()
    const services = group.getServices()

    const [grades, setGrades] = useState<Map<string, GradeLevel>>(
        () => new Map(services.map(service => [service.id.value, GradeLevel.Bien]))
    )
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const rejectedCount = useMemo(
        () => Array.from(grades.values()).filter(level => level === GradeLevel.ARejeter).length,
        [grades]
    )
    const maxRejections = group.maxRejections ?? 0

    function setGrade(serviceId: string, level: GradeLevel) {
        setGrades(previous => new Map(previous).set(serviceId, level))
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            await submitGradesUseCase.execute({ groupId: group.id, grades })
            onSubmitted()
        } catch (err) {
            setError(errorMessageFrom(err))
            setSubmitting(false)
        }
    }

    return (
        <VStack as="form" onSubmit={handleSubmit} gap={5} align="stretch">
            <Box>
                <Heading size="md">Notez chaque service</Heading>
                <Text fontSize="sm" colorPalette="gray" mt={1}>
                    Notez chaque service honnêtement : votre note n'influence que votre propre
                    affectation, jamais celle des autres. Vous pouvez rejeter au maximum{' '}
                    {maxRejections} service{maxRejections > 1 ? 's' : ''} ({rejectedCount}/
                    {maxRejections} utilisé{rejectedCount > 1 ? 's' : ''}).
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

            <Button type="submit" colorPalette="blue" loading={submitting} alignSelf="flex-start">
                Soumettre mes notes définitivement
            </Button>
            <Text fontSize="xs" colorPalette="gray">
                Une fois soumises, vos notes ne peuvent plus être modifiées. Elles deviendront
                visibles de tous les membres du groupe une fois que tout le monde aura soumis les
                siennes.
            </Text>
        </VStack>
    )
}
