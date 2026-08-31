import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Heading, Input, NativeSelect, VStack } from '@chakra-ui/react'
import { GroupEntity, GroupId } from '@domain'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

const NO_SOURCE = ''

export default function CreateGroupPage() {
    const { createGroupUseCase, getMyGroupsUseCase } = useDependencies()
    const navigate = useNavigate()

    const [name, setName] = useState('')
    const [sourceGroupId, setSourceGroupId] = useState(NO_SOURCE)
    const [sourceCandidates, setSourceCandidates] = useState<GroupEntity[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Groups the caller already has access to (created or joined) — the
    // pool a new group can be cloned from. Loaded once; this page doesn't
    // need to stay live-synced with membership changes elsewhere.
    useEffect(() => {
        getMyGroupsUseCase.execute().then(({ created, participating }) => {
            const byId = new Map(
                [...created, ...participating].map(group => [group.id.value, group])
            )
            setSourceCandidates([...byId.values()])
        })
    }, [getMyGroupsUseCase])

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            const { group } = await createGroupUseCase.execute({
                name: name.trim(),
                sourceGroupId: sourceGroupId ? GroupId.from(sourceGroupId) : undefined
            })
            navigate(`/group/${group.id.value}`)
        } catch (err) {
            setError(errorMessageFrom(err))
            setSubmitting(false)
        }
    }

    return (
        <VStack as="form" onSubmit={handleSubmit} gap={5} align="stretch" maxW="480px" mx="auto">
            <Heading size="lg">Créer un groupe</Heading>

            <Field.Root required>
                <Field.Label>Nom du groupe</Field.Label>
                <Input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Promotion 2026 - Stages"
                    required
                />
            </Field.Root>

            {sourceCandidates.length > 0 && (
                <Field.Root>
                    <Field.Label>Créer à partir d'un groupe existant (optionnel)</Field.Label>
                    <NativeSelect.Root>
                        <NativeSelect.Field
                            value={sourceGroupId}
                            onChange={event => setSourceGroupId(event.target.value)}
                        >
                            <option value={NO_SOURCE}>Partir de zéro</option>
                            {sourceCandidates.map(group => (
                                <option key={group.id.value} value={group.id.value}>
                                    {group.name}
                                </option>
                            ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Field.HelperText>
                        Reprend les services, le nombre de rotations et le réglage des services
                        répétés du groupe choisi.
                    </Field.HelperText>
                </Field.Root>
            )}

            <ErrorMessage message={error} />

            <Button type="submit" colorPalette="blue" loading={submitting} disabled={!name.trim()}>
                Créer
            </Button>
        </VStack>
    )
}
