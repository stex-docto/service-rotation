import { Box, Link, Text } from '@chakra-ui/react'

export default function Footer() {
    return (
        <Box as="footer" borderTopWidth="1px" py={4} mt={8}>
            <Text textAlign="center" fontSize="sm" colorPalette="gray">
                Affectation des Stages — répartition équitable des internes entre services de stage.{' '}
                <Link
                    href="https://github.com/stex-docto/service-rotation"
                    target="_blank"
                    rel="noopener noreferrer"
                    textDecoration="underline"
                >
                    Code source
                </Link>
            </Text>
        </Box>
    )
}
