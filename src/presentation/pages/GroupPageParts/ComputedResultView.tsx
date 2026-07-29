import { useEffect, useState } from 'react'
import { Box, Heading, Separator, Table, Text, VStack } from '@chakra-ui/react'
import { Grade, GroupEntity, ResultEntity, RotationPeriod, SubmissionEntity } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { LoadingScreen } from '@presentation/components/LoadingScreen'

interface ComputedResultViewProps {
    group: GroupEntity
}

// Formats an ISO 'YYYY-MM-DD' string as 'DD/MM/YYYY' without going through
// Date, which would reinterpret a date-only string in UTC and risk shifting
// it by a day once displayed in the browser's local timezone.
function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
}

function formatRotationPeriod(period?: RotationPeriod): string {
    if (!period || (!period.startDate && !period.endDate)) {
        return ''
    }
    if (period.startDate && period.endDate) {
        return ` (${formatDate(period.startDate)} – ${formatDate(period.endDate)})`
    }
    if (period.startDate) {
        return ` (à partir du ${formatDate(period.startDate)})`
    }
    return ` (jusqu'au ${formatDate(period.endDate as string)})`
}

export function ComputedResultView({ group }: ComputedResultViewProps) {
    const { getResultUseCase, getAllSubmissionsUseCase } = useDependencies()
    const [result, setResult] = useState<ResultEntity | null>(null)
    const [submissions, setSubmissions] = useState<SubmissionEntity[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        return getResultUseCase.subscribe({ groupId: group.id }, r => setResult(r.result))
    }, [group.id, getResultUseCase])

    useEffect(() => {
        setLoading(true)
        getAllSubmissionsUseCase
            .execute({ groupId: group.id })
            .then(r => setSubmissions(r.submissions))
            .finally(() => setLoading(false))
    }, [group.id, getAllSubmissionsUseCase])

    if (!result || loading) {
        return <LoadingScreen />
    }

    const servicesById = new Map(group.getServices().map(service => [service.id.value, service]))
    const rosterByEmail = new Map(group.getRoster().map(entry => [entry.email.value, entry]))
    const rotationHeaders = Array.from(
        { length: group.rotations },
        (_, i) => `Rotation ${i + 1}${formatRotationPeriod(group.rotationPeriods[i])}`
    )

    return (
        <VStack gap={8} align="stretch">
            <Box>
                <Heading size="lg">{group.name}</Heading>
                <Text colorPalette="gray">Résultat calculé — définitif.</Text>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={3}>
                    Statistiques
                </Heading>
                <Text>
                    Pire note attribuée :{' '}
                    <strong>{Grade.from(result.worstGradeLevel).label}</strong>
                </Text>
                <Text>
                    Somme totale des coûts : <strong>{result.totalCost}</strong> (minimum théorique
                    sans contrainte d'équité : {result.theoreticalMinTotalCost})
                </Text>
                <Text fontSize="sm" colorPalette="gray" mt={2}>
                    L'écart entre les deux est le prix payé pour garantir que personne ne soit
                    sacrifié afin d'améliorer légèrement le total du groupe.
                </Text>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4} overflowX="auto">
                <Heading size="sm" mb={3}>
                    Affectations
                </Heading>
                <Table.Root size="sm">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader>Interne</Table.ColumnHeader>
                            {rotationHeaders.map(header => (
                                <Table.ColumnHeader key={header}>{header}</Table.ColumnHeader>
                            ))}
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {result.assignments.map(assignment => (
                            <Table.Row key={assignment.email.value}>
                                <Table.Cell fontWeight="medium">
                                    {rosterByEmail.get(assignment.email.value)?.displayName ??
                                        assignment.email.value}
                                </Table.Cell>
                                {assignment.rotationServiceIds.map((serviceId, index) => (
                                    <Table.Cell key={index}>
                                        {servicesById.get(serviceId.value)?.name ?? serviceId.value}
                                    </Table.Cell>
                                ))}
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Root>
            </Box>

            <Separator />

            <Box borderWidth="1px" borderRadius="md" p={4} overflowX="auto">
                <Heading size="sm" mb={1}>
                    Transparence : notes de chacun
                </Heading>
                <Text fontSize="sm" colorPalette="gray" mb={3}>
                    Visibles de tous une fois le groupe complet — l'équité se vérifie, elle ne se
                    prend pas sur parole.
                </Text>
                <Table.Root size="sm">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader>Interne</Table.ColumnHeader>
                            {group.getServices().map(service => (
                                <Table.ColumnHeader key={service.id.value}>
                                    {service.name}
                                </Table.ColumnHeader>
                            ))}
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {submissions.map(submission => (
                            <Table.Row key={submission.email.value}>
                                <Table.Cell fontWeight="medium">
                                    {rosterByEmail.get(submission.email.value)?.displayName ??
                                        submission.email.value}
                                </Table.Cell>
                                {group.getServices().map(service => {
                                    const grade = submission.gradeFor(service.id)
                                    return (
                                        <Table.Cell key={service.id.value}>
                                            {grade ? grade.label : '—'}
                                        </Table.Cell>
                                    )
                                })}
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Root>
            </Box>
        </VStack>
    )
}
