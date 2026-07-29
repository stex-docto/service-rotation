// Thrown by ResultRepository.save() when another browser already computed
// and wrote the result first (the result doc is create-only, so exactly one
// writer wins any race — see ComputeResultUseCase, which treats this as a
// signal to re-read rather than an error to surface).
export class ResultAlreadyExistsError extends Error {
    constructor(message: string = 'A result for this group has already been computed') {
        super(message)
        this.name = 'ResultAlreadyExistsError'
    }
}
