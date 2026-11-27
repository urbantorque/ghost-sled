// The five's frames on this lane's build and on the base (git stash), to show the shared paths left them as they were.
const M = Number(process.env.M || 0);
const T = process.env.TIER || 'high';
export default { base: 'http://127.0.0.1:5044/', out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/five/${process.env.SET || 'mine'}/`, m: M, tier: T, tag: `m${M}-${T}-`, query: '&ghosts=0', spots: [{ name: 'a', z: 620, line: 'mid', v: 26 }, { name: 'b', z: 1500, line: 'mid', v: 28 }] };
