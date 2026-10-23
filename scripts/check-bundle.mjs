import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Enforce a small total transfer budget, including any future lazy-loaded chunks.
const directory = path.resolve('dist/client/assets');
const limits = { '.js': 120_000, '.css': 10_000 };
for (const [extension, limit] of Object.entries(limits)) {
  const files = readdirSync(directory).filter((file) => file.endsWith(extension));
  assert(files.length > 0, `No ${extension} production assets were built.`);
  const compressedBytes = files.reduce(
    (sum, file) => sum + gzipSync(readFileSync(path.join(directory, file))).byteLength,
    0,
  );
  assert(
    compressedBytes <= limit,
    `${extension} transfer is ${compressedBytes} gzip bytes; budget is ${limit}.`,
  );
  console.log(`PASS: ${extension} transfer ${compressedBytes} / ${limit} gzip bytes.`);
}
