import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Heading, Input, VStack } from '@chakra-ui/react'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { ErrorMessage } from '@presentation/components/ErrorMessage'
import { errorMessageFrom } from '@presentation/utils/errors'

export default function CreateGroupPage() {
    const { createGroupUseCase } = useDependencies()
    const navigate = useNavigate()

    const [name, setName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            const { group } = await createGroupUseCase.execute({ name: name.trim() })
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

            <ErrorMessage message={error} />

            <Button type="submit" colorPalette="blue" loading={submitting} disabled={!name.trim()}>
                Créer
            </Button>
        </VStack>
    )
}
