export class SignInRequiredError extends Error {
    constructor(message: string = 'You must be signed in to perform this action') {
        super(message)
        this.name = 'SignInRequiredError'
    }
}
