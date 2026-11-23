import { CONCEPTS } from './concepts';
import { FIVE } from './five';
import type { SceneDef } from './kit';

/** Every scene the greybox draws: three of the five from their real sim courses, then the seven concepts. */
export const SCENES: SceneDef[] = [...FIVE, ...CONCEPTS];
