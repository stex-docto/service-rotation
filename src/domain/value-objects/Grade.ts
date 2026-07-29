// A four-level absolute per-service grade. No hard exclusion: every grade,
// including the worst one, is a cost the matching engine may still choose
// under pressure — there is no veto. See CLAUDE.md/README for why this
// replaced the earlier six-level scale with "A rejeter" as a hard exclusion.
export enum GradeLevel {
    Excellent = 0,
    Bien = 1,
    Indifferent = 2,
    Passable = 3
}

const LABELS: Record<GradeLevel, string> = {
    [GradeLevel.Excellent]: 'Excellent',
    [GradeLevel.Bien]: 'Bien',
    [GradeLevel.Indifferent]: 'Indifférent',
    [GradeLevel.Passable]: 'Passable'
}

export class Grade {
    private constructor(public readonly level: GradeLevel) {}

    static readonly ALL_LEVELS: readonly GradeLevel[] = [
        GradeLevel.Excellent,
        GradeLevel.Bien,
        GradeLevel.Indifferent,
        GradeLevel.Passable
    ]

    static from(level: GradeLevel): Grade {
        return new Grade(level)
    }

    // Flow-graph edge cost. Every level is assignable — lower is better.
    get cost(): number {
        return this.level
    }

    get label(): string {
        return LABELS[this.level]
    }

    equals(other: Grade): boolean {
        return this.level === other.level
    }
}
