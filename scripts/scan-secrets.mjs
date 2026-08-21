import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'dist', '.env.example', 'SECURITY.md', 'scripts']);
const patterns = [
  /eyJ[a-zA-Z0-9_-]{20,}/,
  /service_role/i,
  /-----BEGIN (?:RSA|OPENSSH|PRIVATE) KEY-----/,
  /\b(?:password|secret|token)\b\s*[:=]\s*['\"][A-Za-z0-9_+\/=.-]{16,}['\"]/i,
  /\b(?:ghp|gho|ghs|ghr)_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
];
let hits = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const text = await readFile(path, 'utf8').catch(() => '');
      for (const [lineNo, line] of text.split(/\r?\n/).entries()) {
        if (patterns.some((pattern) => pattern.test(line))) hits.push(`${path}:${lineNo + 1}`);
      }
    }
  }
}
await walk(process.cwd());
if (hits.length) {
  console.error(`Potential secrets found:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('Secret scan passed.');
