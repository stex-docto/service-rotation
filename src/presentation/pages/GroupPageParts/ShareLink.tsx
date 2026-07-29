import { useState } from 'react'
import { Box, Button, HStack, Input, Text } from '@chakra-ui/react'

interface ShareLinkProps {
    groupId: string
}

export function ShareLink({ groupId }: ShareLinkProps) {
    const [copied, setCopied] = useState(false)
    const url = `${window.location.origin}${window.location.pathname}#/group/${groupId}`

    async function copy() {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Box borderWidth="1px" borderRadius="md" p={4}>
            <Text fontWeight="medium" mb={2}>
                Lien à partager
            </Text>
            <HStack>
                <Input value={url} readOnly bg="gray.50" fontSize="sm" />
                <Button onClick={copy} variant="outline" flexShrink={0}>
                    {copied ? 'Copié !' : 'Copier'}
                </Button>
            </HStack>
        </Box>
    )
}
