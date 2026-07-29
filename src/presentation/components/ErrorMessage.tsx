import { Box, Text } from '@chakra-ui/react'

interface ErrorMessageProps {
    message: string | null
}

export function ErrorMessage({ message }: ErrorMessageProps) {
    if (!message) return null

    return (
        <Box
            borderWidth="1px"
            borderColor="red.300"
            bg={{ base: 'red.50', _dark: 'red.950' }}
            borderRadius="md"
            p={3}
        >
            <Text colorPalette="red" fontSize="sm">
                {message}
            </Text>
        </Box>
    )
}
