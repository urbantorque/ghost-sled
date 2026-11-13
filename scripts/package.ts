// Packages dist/game into dist/ghost-sled.zip for the CrazyGames developer portal.
// index.html sits at the zip root and every path is relative. Uses a tiny zip writer on top of
// node:zlib so the project needs no extra dependency.
import { deflateRawSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'dist', 'game');
const OUT = join(ROOT, 'dist', 'ghost-sled.zip');

// The budget. CrazyGames' technical requirements (docs.crazygames.com/requirements/technical, as of
// round 7): a build of at most 250 MB and 1,500 files; an initial download (everything fetched up to
// the first start of gameplay) of at most 50 MB, and of at most 20 MB to be eligible for the mobile
// homepage. Ours are tighter on the whole build and take the mobile figure for the first download.
const MB = 1024 * 1024;
const MAX_BUILD = 80 * MB;
const MAX_FILES = 1500;
const MAX_INITIAL = 20 * MB;

// What the initial download is. The score lives in music/ as one pack a piece, a tier and a format
// (`<piece>.<full|lite>.<webm|m4a>.bin`, with two decode probes beside them), and none of it is fetched
// before the first frame. So, up to the first run on a desktop, a player has fetched at most:
//   every file outside music/
//   + the title theme's packs (all of `title.*`: a player takes one, we count them all) and the probes
//   + the desktop pack (`full.webm`) of one course: the largest, whichever they pick.
// The other courses' packs arrive as each is picked and are counted in the whole build only.
function initialDownload(sizes: ReadonlyArray<{ name: string; size: number }>): { bytes: number; course: string } {
  let bytes = 0;
  let course = '';
  let largest = 0;
  for (const f of sizes) {
    if (!f.name.startsWith('music/')) bytes += f.size;
    else if (/^music\/(title|probe)\./.test(f.name)) bytes += f.size;
    else if (/^music\/[^/]+\.full\.webm\.bin$/.test(f.name) && f.size > largest) {
      largest = f.size;
      course = f.name.slice(6);
    }
  }
  return { bytes: bytes + largest, course };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function main(): void {
  if (!existsSync(join(SRC, 'index.html'))) {
    console.error('dist/game/index.html missing: run `npm run build` first.');
    process.exit(1);
  }
  const files = walk(SRC);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const f of files) {
    const name = relative(SRC, f).split('\\').join('/');
    const data = readFileSync(f);
    const comp = deflateRawSync(data, { level: 9 });
    const useStore = comp.length >= data.length;
    const body = useStore ? data : comp;
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(useStore ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useStore ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...locals, centralBuf, end]);
  writeFileSync(OUT, zip);
  const sizes = files.map((f) => ({ name: relative(SRC, f).split('\\').join('/'), size: statSync(f).size }));
  const raw = sizes.reduce((a, f) => a + f.size, 0);
  const first = initialDownload(sizes);
  const mb = (n: number): string => (n / MB).toFixed(2);
  console.log(`dist/ghost-sled.zip: ${(zip.length / MB).toFixed(2)} MB zipped`);
  console.log(`Whole build: ${mb(raw)} MB (at most ${MAX_BUILD / MB})`);
  console.log(`Initial download: ${mb(first.bytes)} MB (at most ${MAX_INITIAL / MB}; with ${first.course || 'no course pack'})`);
  console.log(`Files: ${files.length} (at most ${MAX_FILES})`);
  const over: string[] = [];
  if (raw > MAX_BUILD) over.push(`The build is ${mb(raw)} MB, over the ${MAX_BUILD / MB} MB budget.`);
  if (files.length > MAX_FILES) over.push(`The build has ${files.length} files, over the limit of ${MAX_FILES}.`);
  if (first.bytes > MAX_INITIAL) over.push(`The initial download is ${mb(first.bytes)} MB, over the ${MAX_INITIAL / MB} MB budget.`);
  if (over.length) {
    for (const line of over) console.error(line);
    process.exit(1);
  }
}

main();
