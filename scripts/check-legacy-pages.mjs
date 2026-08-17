import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const requiredPages = [
  'index.html', 'login.html', 'create.html', 'edit.html', 'item.html',
  'users.html', 'user.html', 'portfolio.html', 'forum.html', 'messages.html',
  'settings.html', 'orders.html'
];
const forbiddenPatterns = [
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/i,
  /-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/i,
  /sk_(?:live|test)_[A-Za-z0-9]+/i
];

const failures = [];
for (const page of requiredPages) {
  const path = join(root, page);
  if (!existsSync(path)) {
    failures.push(`missing required page: ${page}`);
    continue;
  }
  const source = readFileSync(path, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) failures.push(`${page}: matched forbidden secret pattern ${pattern}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Legacy page check passed (${requiredPages.length} required pages).`);
}
