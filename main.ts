// Tiny stack VM, faithful port of the reference vm.mjs in the kit.
// ISA: generator/subject/ISA.md. Traps 2-11, step/output limits, wrapping
// 32-bit arithmetic, unsigned DIVU/MODU/LTU, exact MUL via Math.imul.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function run(p, inp) {
  const D = new Int32Array(256); let s = 0;
  const C = new Int32Array(64); let c = 0;
  const M = new Int32Array(256);
  const o = new Uint8Array(65536); let ol = 0, ip = 0, pc = 0, st = 0;
  const n = p.length;
  const trap = (e) => ({ o: o.slice(0, ol), e });
  for (;;) {
    if (st === 1000000) return trap(10);
    if (pc < 0 || pc >= n) return trap(9);
    const op = p[pc];
    const kn = op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) || (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
    if (!kn) return trap(5);
    const im = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + im >= n) return trap(9);
    st++; const nx = pc + 1 + im; pc = nx;
    switch (op) {
      case 0x00: return { o: o.slice(0, ol), e: 0 };
      case 0x01: if (s >= 256) return trap(3); D[s++] = (p[nx - 1] << 24) >> 24; break;
      case 0x02: if (s >= 256) return trap(3); D[s++] = p[nx - 4] | p[nx - 3] << 8 | p[nx - 2] << 16 | p[nx - 1] << 24; break;
      case 0x03: if (s < 1) return trap(2); s--; break;
      case 0x04: if (s < 1) return trap(2); if (s >= 256) return trap(3); D[s] = D[s - 1]; s++; break;
      case 0x05: if (s < 2) return trap(2); { const t = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = t; } break;
      case 0x06: if (s < 2) return trap(2); if (s >= 256) return trap(3); D[s] = D[s - 2]; s++; break;
      case 0x07: if (s < 3) return trap(2); { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; } break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e: case 0x20: case 0x21: case 0x22: {
        if (s < 2) return trap(2);
        const b = D[s - 1], a = D[s - 2]; let r = 0;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (!b) return trap(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (!b) return trap(4); r = b === -1 ? 0 : a % b | 0; }
        else if (op === 0x15) { if (!b) return trap(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (!b) return trap(4); r = (a >>> 0) % (b >>> 0) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s -= 2; D[s++] = r; break;
      }
      case 0x17: if (s < 1) return trap(2); D[s - 1] = -D[s - 1] | 0; break;
      case 0x1b: if (s < 1) return trap(2); D[s - 1] = ~D[s - 1]; break;
      case 0x30: { const rel = ((p[nx - 2] | p[nx - 1] << 8) << 16) >> 16; pc = nx + rel; break; }
      case 0x31: case 0x32: if (s < 1) return trap(2); { const v = D[--s]; const rel = ((p[nx - 2] | p[nx - 1] << 8) << 16) >> 16; if ((op === 0x31) === (v === 0)) pc = nx + rel; break; }
      case 0x33: if (c >= 64) return trap(7); C[c++] = nx; pc = p[nx - 2] | p[nx - 1] << 8; break;
      case 0x34: if (c === 0) return trap(8); pc = C[--c]; break;
      case 0x40: if (s < 1) return trap(2); { const a = D[s - 1]; if (a < 0 || a >= 256) return trap(6); D[s - 1] = M[a]; break; }
      case 0x41: if (s < 2) return trap(2); { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a >= 256) return trap(6); s -= 2; M[a] = v; break; }
      case 0x50: if (s < 1) return trap(2); { const t = String(D[s - 1]); if (ol + t.length > 65536) return trap(11); s--; for (let i = 0; i < t.length; i++) o[ol++] = t.charCodeAt(i); break; }
      case 0x51: if (s < 1) return trap(2); if (ol + 1 > 65536) return trap(11); o[ol++] = D[--s] & 255; break;
      case 0x52: if (s >= 256) return trap(3); D[s++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53: if (s < 1) return trap(2); return { o: o.slice(0, ol), e: D[--s] & 255 };
      default: return trap(5);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.o);
  writeFileSync(join(O, id, 'exit.txt'), `${r.e}\n`);
}
