import { Box, Button, Flex, Heading, HStack, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { useCurrentUser } from '@presentation/hooks/useCurrentUser'
import { useDependencies } from '@presentation/hooks/useDependencies'
import { GuestSignInButton } from '@presentation/components/GuestSignInButton'

export default function Header() {
    const { signInUseCase } = useDependencies()
    const { user, loading } = useCurrentUser()

    return (
        <Box as="header" borderBottomWidth="1px" py={3}>
            <Flex maxW="960px" mx="auto" px={4} align="center" justify="space-between">
                <RouterLink to="/">
                    <Heading size="md">Affectation des Stages</Heading>
                </RouterLink>

                <HStack gap={4}>
                    {!loading && user && (
                        <Text fontSize="sm" colorPalette="gray">
                            {user.displayName}
                        </Text>
                    )}
                    {!loading && user && (
                        <Button size="sm" variant="outline" onClick={() => signInUseCase.signOut()}>
                            Se déconnecter
                        </Button>
                    )}
                    {!loading && !user && (
                        <Button
                            size="sm"
                            colorPalette="blue"
                            onClick={() => signInUseCase.signInWithGoogle()}
                        >
                            Se connecter avec Google
                        </Button>
                    )}
                    {!loading && !user && <GuestSignInButton size="sm" />}
                </HStack>
            </Flex>
        </Box>
    )
}
