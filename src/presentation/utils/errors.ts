// Use-case errors are plain Error instances with a human-readable message —
// see the application layer. This just guards against non-Error throws.
export function errorMessageFrom(error: unknown): string {
    if (error instanceof Error) return error.message
    return 'Une erreur inattendue est survenue.'
}
