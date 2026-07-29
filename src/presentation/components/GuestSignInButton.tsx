import { Button, ButtonProps } from '@chakra-ui/react'
import { useDependencies } from '@presentation/hooks/useDependencies'

// Dev-only "continue as guest" entry point, backed by Firebase Anonymous
// Authentication. Gating on `import.meta.env.DEV` is a UX courtesy, not the
// real security boundary: the Anonymous provider is only enabled in the dev
// Firebase project's console, not prod, so signInAnonymously() would simply
// fail against prod even if this check were bypassed.
export function GuestSignInButton(props: ButtonProps) {
    const { signInUseCase } = useDependencies()

    if (!import.meta.env.DEV) return null

    return (
        <Button variant="outline" onClick={() => signInUseCase.signInAnonymously()} {...props}>
            Continuer en tant qu'invité
        </Button>
    )
}
