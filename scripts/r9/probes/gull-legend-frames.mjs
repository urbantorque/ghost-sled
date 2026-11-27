// Gullhaven's legends, staged: the Beacon Keeper (?legend=1) and the Herring Lights (?legend=2), as the run meets them.
const L = process.env.LEG || '1';
const spots =
  L === '1'
    ? [
        { name: 'keeper-a-said', z: 1000, line: 'mid', v: 26 },
        { name: 'keeper-b-walk', z: 1110, line: 'mid', v: 26 },
        { name: 'keeper-c-walk', z: 1190, line: 'mid', v: 26 },
      ]
    : [
        { name: 'fleet-a-said', z: 2400, line: 'mid', v: 30 },
        { name: 'fleet-b-lit', z: 2560, line: 'mid', v: 30 },
        { name: 'fleet-c-air', z: 2262, line: 'air', v: 31, h: 18, vy: -1 },
        { name: 'fleet-d-lit', z: 2680, line: 'mid', v: 30 },
      ];
export default { base: 'http://127.0.0.1:5044/', out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/legends/${process.env.SET || 'v1'}/`, m: 6, tier: process.env.TIER || 'high', hour: process.env.HOUR || 'day', query: `&ghosts=0&legend=${L}`, spots };
