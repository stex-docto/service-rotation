import { useRef, useState } from 'react'
import { Box, Heading, NumberInput, Switch, Table, Text } from '@chakra-ui/react'
import { CurrentUser, GroupEntity, UserId } from '@domain'
import { MAX_MANUAL_SHIFT_HISTORY } from '@application'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

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
    const { updateGroupSettingsUseCase, setMemberShiftHistoryUseCase } = useDependencies()

    const [enabled, setEnabled] = useState(group.pastShiftsEnabled)
    const [error, setError] = useState<string | null>(null)

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
        </Box>
    )
}
