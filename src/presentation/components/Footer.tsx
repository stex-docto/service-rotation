import { Box, Text } from '@chakra-ui/react'

export default function Footer() {
    return (
        <Box as="footer" borderTopWidth="1px" py={4} mt={8}>
            <Text textAlign="center" fontSize="sm" colorPalette="gray">
                Affectation des Stages — répartition équitable des internes entre services de stage.
            </Text>
        </Box>
    )
}
