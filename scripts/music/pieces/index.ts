import type { Piece } from '../piece';
import { ember } from './ember';
import { frostfang } from './frostfang';
import { gullhaven } from './gullhaven';
import { lanternfall } from './lanternfall';
import { oldrun } from './oldrun';
import { pinecrest } from './pinecrest';
import { sakura } from './sakura';
import { title } from './title';

/** Every piece of the score: the courses in MOUNTAINS's order (the five, then round 9's), then the title. */
export const PIECES: readonly Piece[] = [pinecrest, frostfang, ember, sakura, lanternfall, oldrun, gullhaven, title];
