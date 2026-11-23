import { describe, expect, it } from 'vitest';
import { BOT_SKILLS, BOT_STYLES, DAILY_KEYS, SCRIPT_ROLLS, botRide, chaosFacts, courseFacts, courseSeeds, digest, fiveSeeds, pilotRide, scriptedRide } from '../scripts/r9/fivedigest';
import { dailySeed } from '../src/sim/mountains';

// Round 9 opens the sim once, additively, for three new mountains, and the five must not move by a bit (the brief's
// section 3; notes/r9-ground.md section 0). These are the five's fingerprints, captured on round-9 at 6255b8d before any
// sim edit by scripts/r9/five-fingerprint.ts: every course (and the fairness suite's six Dailies) as values, every roll
// the game makes, and the rides a scripted rider, the bot and the lab's pilots make on them. A failure here means
// something the five run was changed: find it, do not re-capture. (About 7 s of one worker on the laptop.)

const COURSES: Record<string, string> = {
  pinecrest: '91b11dab4a894036',
  frostfang: '4dc9641aecd4c08e',
  ember: 'b9d1d4b0c097f389',
  sakura: 'f1a8402db239946f',
  lanternfall: 'c4b721343cc984ae',
  'daily 2026-10-24': 'eb0a1b97a10dfcc6',
  'daily 2026-12-25': '62e4f555e8ef5efe',
  'daily 2027-03-01': '5408eeb28551afc9',
  'daily 2027-07-19': 'e58362fba3f537db',
  'daily 2027-01-02': 'ef6ec2e6f5eff1d6',
  'daily 2027-05-30': '2befb82048bb5d4a',
};
const CHAOS = '971b49a82c74646b';
const SCRIPTED: Record<string, string> = {
  pinecrest: '9a7c7d176e3a3997',
  frostfang: '1adc580ed293bd94',
  ember: 'c43c0fba4a853568',
  sakura: '4422f1b1fe3dcf1f',
  lanternfall: '059f73b3a1a4275c',
};
const BOTS: Record<string, string> = {
  pinecrest: '86193f85bab751ea',
  frostfang: '2179545dfc7f98e2',
  ember: '4651f33aad0fad35',
  sakura: 'b15d762473fcb63f',
  lanternfall: '867b69f96b9a698d',
  'daily 2026-10-24': '72fb9aef3e70adfb',
};
const PILOTS: Record<string, string> = {
  pinecrest: '19cb84d305621951',
  frostfang: 'a7c050f397f53861',
  ember: '22ecaef6a1fd3917',
  sakura: '31a3d9253534ecf3',
  lanternfall: '9fcd25655751e36f',
};

describe('the five, byte for byte', () => {
  for (const { id, seed } of courseSeeds()) {
    it(`${id}: the course is what it was`, () => {
      expect(digest(courseFacts(seed))).toBe(COURSES[id]);
    });
  }

  it('every roll the game makes is what it was (a run, its event, the Cup, the Trial, a night)', () => {
    expect(digest(chaosFacts())).toBe(CHAOS);
  });

  for (const { id, seed } of fiveSeeds()) {
    it(`${id}: a scripted rider, the bot and the lab's pilots ride it as they did`, () => {
      expect(digest(SCRIPT_ROLLS.map((r, k) => scriptedRide(seed, r, k * 2 + 1, 60 * 90)))).toBe(SCRIPTED[id]);
      const rides: unknown[] = [];
      for (const skill of BOT_SKILLS) for (const style of BOT_STYLES) rides.push(botRide(seed, skill, style));
      expect(digest(rides)).toBe(BOTS[id]);
      expect(digest([pilotRide(seed, 'mid', 1234), pilotRide(seed, 'clumsy', 1271)])).toBe(PILOTS[id]);
    }, 60_000);
  }

  it('the bot rides a Daily as it did', () => {
    const rides: unknown[] = [];
    for (const skill of BOT_SKILLS) for (const style of BOT_STYLES) rides.push(botRide(dailySeed(DAILY_KEYS[0]), skill, style));
    expect(digest(rides)).toBe(BOTS[`daily ${DAILY_KEYS[0]}`]);
  }, 60_000);
});
