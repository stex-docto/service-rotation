export class PermissionError extends Error {
    constructor(message: string = 'You do not have permission to perform this action') {
        super(message)
        this.name = 'PermissionError'
    }
}
