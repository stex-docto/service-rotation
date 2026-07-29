import { Box, Heading, Separator, Table, Text, VStack } from '@chakra-ui/react'
import { Grade, GroupEntity, RotationSlot } from '@domain'
import { ComputeResultResult } from '@application'

interface LiveResultViewProps {
    group: GroupEntity
    computeResult: ComputeResultResult
}

// Formats an ISO 'YYYY-MM-DD' string as 'DD/MM/YYYY' without going through
// Date, which would reinterpret a date-only string in UTC and risk shifting
// it by a day once displayed in the browser's local timezone.
function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
}

// Whichever mode is active IS the header — "Rotation N" is only a fallback
// for a slot nobody named or dated, not a permanent prefix.
function formatRotationHeader(
    slot: RotationSlot | undefined,
    mode: 'name' | 'date',
    index: number
): string {
    if (!slot) {
        return `Rotation ${index + 1}`
    }
    if (mode === 'name') {
        return slot.name || `Rotation ${index + 1}`
    }
    if (slot.startDate && slot.endDate) {
        return `${formatDate(slot.startDate)} – ${formatDate(slot.endDate)}`
    }
    if (slot.startDate) {
        return `À partir du ${formatDate(slot.startDate)}`
    }
    if (slot.endDate) {
        return `Jusqu'au ${formatDate(slot.endDate)}`
    }
    return `Rotation ${index + 1}`
}

// A snapshot from an on-demand local computation — never the read side of a
// stored document (see README's security model: there is no canonical
// "final" result any more). If includedCount < totalMembers, this is
// provisional and will change as the remaining members vote.
export function LiveResultView({ group, computeResult }: LiveResultViewProps) {
    const { result, votes, totalMembers } = computeResult

    const membersById = new Map(group.getMembers().map(member => [member.userId.value, member]))
    const servicesById = new Map(group.getServices().map(service => [service.id.value, service]))
    const rotationHeaders = Array.from({ length: group.rotations }, (_, i) =>
        formatRotationHeader(group.rotationSlots[i], group.rotationMode, i)
    )

    if (!result) {
        return (
            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={2}>
                    Pas encore de résultat calculable
                </Heading>
                <Text colorPalette="gray">
                    {votes.length === 0
                        ? "Aucun vote n'est encore lisible — verrouillez le vôtre pour commencer."
                        : "Aucune affectation valide n'existe avec les votes actuellement lisibles. Cela devrait se résoudre une fois d'autres membres votés."}
                </Text>
            </Box>
        )
    }

    const includedCount = result.includedUserIds.length
    const isProvisional = includedCount < totalMembers

    return (
        <VStack gap={8} align="stretch">
            {/* The featured piece: everyone reads this page for their affectation. */}
            <Box overflowX="auto">
                <Heading size="lg" mb={4}>
                    Affectations
                </Heading>
                <Table.Root size="md">
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
                            <Table.Row key={assignment.userId.value}>
                                <Table.Cell fontWeight="medium">
                                    {membersById.get(assignment.userId.value)?.displayName ??
                                        assignment.userId.value}
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

            {/* Everything below is detail, not the main event. */}
            {group.getServices().some(service => service.description) && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                    <Heading size="xs" mb={2} colorPalette="gray">
                        Services
                    </Heading>
                    <VStack gap={1} align="stretch">
                        {group
                            .getServices()
                            .filter(service => service.description)
                            .map(service => (
                                <Text key={service.id.value} fontSize="sm">
                                    <Text as="span" fontWeight="medium">
                                        {service.name}
                                    </Text>{' '}
                                    — {service.description}
                                </Text>
                            ))}
                    </VStack>
                </Box>
            )}

            <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="xs" mb={2} colorPalette="gray">
                    Statistiques
                </Heading>
                <Text fontSize="sm">
                    Pire note attribuée :{' '}
                    <strong>{Grade.from(result.worstGradeLevel).label}</strong>
                </Text>
                <Text fontSize="sm">
                    Somme totale des coûts : <strong>{result.totalCost}</strong> (minimum théorique
                    sans contrainte d'équité : {result.theoreticalMinTotalCost})
                </Text>
                <Text fontSize="xs" colorPalette="gray" mt={2}>
                    L'écart entre les deux est le prix payé pour garantir que personne ne soit
                    sacrifié afin d'améliorer légèrement le total du groupe.
                </Text>
            </Box>

            <Box borderWidth="1px" borderRadius="md" p={4} overflowX="auto">
                <Heading size="xs" mb={1} colorPalette="gray">
                    Transparence : votes de chacun
                </Heading>
                <Text fontSize="xs" colorPalette="gray" mb={3}>
                    Visible uniquement par les membres ayant eux-mêmes verrouillé leur vote —
                    l'équité se vérifie, elle ne se prend pas sur parole.
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
                        {votes.map(vote => (
                            <Table.Row key={vote.userId.value}>
                                <Table.Cell fontWeight="medium">
                                    {membersById.get(vote.userId.value)?.displayName ??
                                        vote.userId.value}
                                </Table.Cell>
                                {group.getServices().map(service => {
                                    const grade = vote.gradeFor(service.id)
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

            <Text fontSize="xs" colorPalette={isProvisional ? 'orange.600' : 'gray'}>
                {isProvisional
                    ? `Résultat provisoire — ${includedCount} / ${totalMembers} membres ont voté et sont inclus. Il changera si les votes ou l'appartenance au groupe évoluent.`
                    : `Résultat stable — les ${totalMembers} membres ont tous voté et le groupe n'accepte plus de nouveaux membres. Tout recalcul redonnera exactement le même résultat.`}
            </Text>
        </VStack>
    )
}
