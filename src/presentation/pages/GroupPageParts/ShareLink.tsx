import { useState } from 'react'
import { Box, Button, HStack, Input, Text } from '@chakra-ui/react'

interface ShareLinkProps {
    groupId: string
    inviteOpen: boolean
    rosterLocked: boolean
}

export function ShareLink({ groupId, inviteOpen, rosterLocked }: ShareLinkProps) {
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
            <Text fontSize="xs" colorPalette="gray" mt={2}>
                {rosterLocked
                    ? "Les membres sont verrouillés définitivement depuis l'activation de la notation — pour l'équité, plus personne ne peut rejoindre désormais."
                    : inviteOpen
                      ? "Tant que c'est ouvert, quiconque a le lien peut rejoindre le groupe."
                      : 'Plus personne ne peut rejoindre le groupe avec ce lien.'}
            </Text>
        </Box>
    )
}
