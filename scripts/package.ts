// Packages dist/game into dist/ghost-sled.zip for the CrazyGames developer portal.
// index.html sits at the zip root and every path is relative. Uses a tiny zip writer on top of
// node:zlib so the project needs no extra dependency.
import { deflateRawSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'dist', 'game');
const OUT = join(ROOT, 'dist', 'ghost-sled.zip');
const LIMIT = 5 * 1024 * 1024;

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
  const raw = files.reduce((a, f) => a + statSync(f).size, 0);
  console.log(`dist/ghost-sled.zip: ${files.length} files, ${(raw / 1024).toFixed(0)} KB unpacked, ${(zip.length / 1024).toFixed(0)} KB zipped`);
  if (raw > LIMIT) {
    console.error(`Build is ${(raw / 1048576).toFixed(2)} MB, over the 5 MB budget.`);
    process.exit(1);
  }
}

main();
