import type { Piece } from '../piece';
import { ember } from './ember';
import { frostfang } from './frostfang';
import { lanternfall } from './lanternfall';
import { pinecrest } from './pinecrest';
import { sakura } from './sakura';
import { title } from './title';

/** Every piece of the score: the five courses in the order they unlock, then the title. */
export const PIECES: readonly Piece[] = [pinecrest, frostfang, ember, sakura, lanternfall, title];
