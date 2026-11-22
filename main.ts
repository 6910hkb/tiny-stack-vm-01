// A tiny stack machine for the make.fun bounty.
// It runs one bytecode program per instance and writes that program's
// output bytes plus its exit code. All numbers wrap to 32 bits.
// Traps: 2 underflow, 3 overflow, 4 divide by zero, 5 bad opcode,
// 6 bad memory, 7 call overflow, 8 empty return, 9 bad pc,
// 10 step limit (1,000,000), 11 output limit (65,536 bytes).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function solve(prog, input) {
  const stack = new Int32Array(256);
  const calls = new Int32Array(64);
  const memory = new Int32Array(256);
  const bytesOut = new Uint8Array(65536);
  let top = 0;
  let callTop = 0;
  let outLen = 0;
  let inPos = 0;
  let pc = 0;
  let steps = 0;
  const total = prog.length;
  function fail(code) {
    return { bytes: bytesOut.slice(0, outLen), code };
  }
  function need(n) {
    if (top < n) return true;
    return false;
  }
  function room(n) {
    if (top + n > 256) return true;
    return false;
  }
  while (true) {
    if (steps === 1000000) return fail(10);
    if (pc < 0 || pc >= total) return fail(9);
    const op = prog[pc];
    const known = op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) || (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
    if (!known) return fail(5);
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + imm >= total) return fail(9);
    steps += 1;
    const after = pc + 1 + imm;
    pc = after;
    if (op === 0) return { bytes: bytesOut.slice(0, outLen), code: 0 };
    if (op === 1) {
      if (room(1)) return fail(3);
      stack[top++] = (prog[after - 1] << 24) >> 24;
      continue;
    }
    if (op === 2) {
      if (room(1)) return fail(3);
      stack[top++] = prog[after - 4] | (prog[after - 3] << 8) | (prog[after - 2] << 16) | (prog[after - 1] << 24);
      continue;
    }
    if (op === 3) {
      if (need(1)) return fail(2);
      top -= 1;
      continue;
    }
    if (op === 4) {
      if (need(1)) return fail(2);
      if (room(1)) return fail(3);
      stack[top] = stack[top - 1];
      top += 1;
      continue;
    }
    if (op === 5) {
      if (need(2)) return fail(2);
      const tmp = stack[top - 1];
      stack[top - 1] = stack[top - 2];
      stack[top - 2] = tmp;
      continue;
    }
    if (op === 6) {
      if (need(2)) return fail(2);
      if (room(1)) return fail(3);
      stack[top] = stack[top - 2];
      top += 1;
      continue;
    }
    if (op === 7) {
      if (need(3)) return fail(2);
      const first = stack[top - 3];
      stack[top - 3] = stack[top - 2];
      stack[top - 2] = stack[top - 1];
      stack[top - 1] = first;
      continue;
    }
    if (op === 23) {
      if (need(1)) return fail(2);
      stack[top - 1] = -stack[top - 1] | 0;
      continue;
    }
    if (op === 27) {
      if (need(1)) return fail(2);
      stack[top - 1] = ~stack[top - 1];
      continue;
    }
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27 && op !== 31) {
      if (need(2)) return fail(2);
      const rhs = stack[top - 1];
      const lhs = stack[top - 2];
      let value = 0;
      if (op === 16) value = (lhs + rhs) | 0;
      else if (op === 17) value = (lhs - rhs) | 0;
      else if (op === 18) value = Math.imul(lhs, rhs);
      else if (op === 19) {
        if (rhs === 0) return fail(4);
        value = lhs === -2147483648 && rhs === -1 ? lhs : (lhs / rhs) | 0;
      } else if (op === 20) {
        if (rhs === 0) return fail(4);
        value = rhs === -1 ? 0 : (lhs % rhs) | 0;
      } else if (op === 21) {
        if (rhs === 0) return fail(4);
        value = Math.floor((lhs >>> 0) / (rhs >>> 0)) | 0;
      } else if (op === 22) {
        if (rhs === 0) return fail(4);
        value = ((lhs >>> 0) % (rhs >>> 0)) | 0;
      } else if (op === 24) value = lhs & rhs;
      else if (op === 25) value = lhs | rhs;
      else if (op === 26) value = lhs ^ rhs;
      else if (op === 28) value = lhs << (rhs & 31);
      else if (op === 29) value = lhs >> (rhs & 31);
      else if (op === 30) value = (lhs >>> (rhs & 31)) | 0;
      else if (op === 32) value = lhs === rhs ? 1 : 0;
      else if (op === 33) value = lhs < rhs ? 1 : 0;
      else value = (lhs >>> 0) < (rhs >>> 0) ? 1 : 0;
      top -= 2;
      stack[top++] = value;
      continue;
    }
    if (op === 48) {
      const rel = ((prog[after - 2] | (prog[after - 1] << 8)) << 16) >> 16;
      pc = after + rel;
      continue;
    }
    if (op === 49 || op === 50) {
      if (need(1)) return fail(2);
      const v = stack[--top];
      const rel = ((prog[after - 2] | (prog[after - 1] << 8)) << 16) >> 16;
      if ((op === 49) === (v === 0)) pc = after + rel;
      continue;
    }
    if (op === 51) {
      if (callTop >= 64) return fail(7);
      calls[callTop++] = after;
      pc = prog[after - 2] | (prog[after - 1] << 8);
      continue;
    }
    if (op === 52) {
      if (callTop === 0) return fail(8);
      pc = calls[--callTop];
      continue;
    }
    if (op === 64) {
      if (need(1)) return fail(2);
      const addr = stack[top - 1];
      if (addr < 0 || addr >= 256) return fail(6);
      stack[top - 1] = memory[addr];
      continue;
    }
    if (op === 65) {
      if (need(2)) return fail(2);
      const addr = stack[top - 1];
      const val = stack[top - 2];
      if (addr < 0 || addr >= 256) return fail(6);
      top -= 2;
      memory[addr] = val;
      continue;
    }
    if (op === 80) {
      if (need(1)) return fail(2);
      const text = String(stack[top - 1]);
      if (outLen + text.length > 65536) return fail(11);
      top -= 1;
      for (let i = 0; i < text.length; i++) bytesOut[outLen++] = text.charCodeAt(i);
      continue;
    }
    if (op === 81) {
      if (need(1)) return fail(2);
      if (outLen + 1 > 65536) return fail(11);
      bytesOut[outLen++] = stack[--top] & 255;
      continue;
    }
    if (op === 82) {
      if (room(1)) return fail(3);
      stack[top++] = inPos < input.length ? input[inPos++] : -1;
      continue;
    }
    if (op === 83) {
      if (need(1)) return fail(2);
      return { bytes: bytesOut.slice(0, outLen), code: stack[--top] & 255 };
    }
    return fail(5);
  }
}

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const name of readdirSync(inputDir).sort()) {
  const program = new Uint8Array(readFileSync(join(inputDir, name, "program.bin")));
  const input = new Uint8Array(readFileSync(join(inputDir, name, "input.bin")));
  const result = solve(program, input);
  mkdirSync(join(outputDir, name), { recursive: true });
  writeFileSync(join(outputDir, name, "stdout.bin"), result.bytes);
  writeFileSync(join(outputDir, name, "exit.txt"), `${result.code}\n`);
}
