export class GroupNotFoundError extends Error {
    constructor(message: string = 'Group not found') {
        super(message)
        this.name = 'GroupNotFoundError'
    }
}
