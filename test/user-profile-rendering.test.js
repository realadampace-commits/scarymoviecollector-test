import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../user.html', import.meta.url), 'utf8');

test('profile item cards escape user-controlled titles and image URLs before HTML rendering', () => {
  assert.match(page, /import \{ escapeHtml \} from '\.\/src\/ui\.js';/);
  assert.match(page, /title="\$\{escapeHtml\(title \|\| 'Item'\)\}"/);
  assert.match(page, /<h4 class="itemTitle">\$\{escapeHtml\(title \|\| 'Untitled'\)\}<\/h4>/);
  assert.match(page, /<img src="\$\{escapeHtml\(img\)\}" alt="">/);
});
