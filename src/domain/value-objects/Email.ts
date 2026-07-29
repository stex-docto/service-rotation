const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Email {
    private constructor(private readonly _value: string) {}

    static from(value: string): Email {
        const trimmed = value.trim().toLowerCase()

        if (!EMAIL_PATTERN.test(trimmed)) {
            throw new Error(`Invalid email address: ${value}`)
        }

        return new Email(trimmed)
    }

    get value(): string {
        return this._value
    }

    equals(other: Email): boolean {
        return this._value === other._value
    }

    toString(): string {
        return this._value
    }
}
