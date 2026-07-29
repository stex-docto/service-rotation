import { Center, Spinner } from '@chakra-ui/react'

export function LoadingScreen() {
    return (
        <Center minH="60vh">
            <Spinner size="xl" colorPalette="blue" />
        </Center>
    )
}
