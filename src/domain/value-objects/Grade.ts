// The six mentions of a majority-judgment-style verbal scale (Balinski & Laraki),
// used here as an absolute per-service grade rather than a forced total ordering.
// "A rejeter" is a hard constraint, not a heavy cost: the matching engine excludes
// the edge entirely instead of weighting it. See Grade.isRejection / Grade.cost.
export enum GradeLevel {
    Excellent = 0,
    TresBien = 1,
    Bien = 2,
    Passable = 3,
    Insuffisant = 4,
    ARejeter = 5
}

const LABELS: Record<GradeLevel, string> = {
    [GradeLevel.Excellent]: 'Excellent',
    [GradeLevel.TresBien]: 'Très bien',
    [GradeLevel.Bien]: 'Bien',
    [GradeLevel.Passable]: 'Passable',
    [GradeLevel.Insuffisant]: 'Insuffisant',
    [GradeLevel.ARejeter]: 'À rejeter'
}

export class Grade {
    private constructor(public readonly level: GradeLevel) {}

    static readonly ALL_LEVELS: readonly GradeLevel[] = [
        GradeLevel.Excellent,
        GradeLevel.TresBien,
        GradeLevel.Bien,
        GradeLevel.Passable,
        GradeLevel.Insuffisant,
        GradeLevel.ARejeter
    ]

    // Acceptable levels are the ones the matching engine may assign someone to.
    // ARejeter is deliberately excluded — it never has a cost, only an exclusion.
    static readonly ACCEPTABLE_LEVELS: readonly GradeLevel[] = [
        GradeLevel.Excellent,
        GradeLevel.TresBien,
        GradeLevel.Bien,
        GradeLevel.Passable,
        GradeLevel.Insuffisant
    ]

    static from(level: GradeLevel): Grade {
        return new Grade(level)
    }

    get isRejection(): boolean {
        return this.level === GradeLevel.ARejeter
    }

    // Flow-graph edge cost. Throws for a rejection: a rejected pair must be
    // excluded from the graph, never weighted, or "A rejeter" degrades into a
    // large-but-finite cost the optimiser could still choose under pressure.
    get cost(): number {
        if (this.isRejection) {
            throw new Error(
                'A rejected grade has no cost — exclude the edge instead of weighting it'
            )
        }
        return this.level
    }

    get label(): string {
        return LABELS[this.level]
    }

    equals(other: Grade): boolean {
        return this.level === other.level
    }
}
