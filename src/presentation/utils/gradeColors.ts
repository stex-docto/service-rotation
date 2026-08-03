import { GradeLevel } from '@domain'

// Single source of truth for how each grade level is colored, shared by the
// vote form's buttons and the results view's grade cells so both stay in
// sync as a matter of course rather than by convention.
export const GRADE_COLOR_PALETTE: Record<GradeLevel, string> = {
    [GradeLevel.Excellent]: 'green',
    [GradeLevel.Bien]: 'blue',
    [GradeLevel.Indifferent]: 'gray',
    [GradeLevel.Passable]: 'red'
}

// Light background tint for a grade level, for read-only displays (e.g. the
// results view's transparency table) rather than interactive buttons.
export function gradeBg(level: GradeLevel): { base: string; _dark: string } {
    const palette = GRADE_COLOR_PALETTE[level]
    return { base: `${palette}.100`, _dark: `${palette}.900` }
}
