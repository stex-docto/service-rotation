import React from 'react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'

interface UIProviderProps {
    children: React.ReactNode
}

export function UI_Provider({ children }: UIProviderProps) {
    return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
}
