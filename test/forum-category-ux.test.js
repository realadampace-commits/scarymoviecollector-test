import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../forum_category.html', import.meta.url), 'utf8');
const code = await readFile(new URL('../src/pages/forum-category.js', import.meta.url), 'utf8');

test('category post loading and empty-state feedback is announced', () => {
  assert.match(page, /<div id="postsStatus"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('category hides the status card when posts are available', () => {
  assert.match(code, /postsStatus\.hidden = Boolean\(posts\.length\)/);
  assert.match(code, /postsStatus\.hidden = false/);
});

test('category retries clear stale posts and expose loading state', () => {
  assert.match(code, /postsStatus\.textContent = 'Loading posts…'/);
  assert.match(code, /postsList\.replaceChildren\(\)/);
  assert.match(code, /postsCard\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(code, /postsCard\.removeAttribute\('aria-busy'\)/);
});
test('category errors provide a retry action', () => {
  assert.match(code, /Retry loading category/);
  assert.match(code, /retry-category/);
  assert.match(code, /loadCategory\(\)/);
});

test('guests can reach sign-in and return to the category before posting', () => {
  assert.match(code, /Sign in to post/);
  assert.match(code, /login\.html\?next=\$\{encodeURIComponent\(returnUrl\)\}/);
});

test('category cards render real engagement instead of hard-coded zero counts', () => {
  assert.match(code, /getForumPostEngagement/);
  assert.match(code, /engagement\.likes\.count/);
  assert.match(code, /engagement\.replies\.length/);
  assert.doesNotMatch(code, /<span>♡ 0<\/span><span>0 comments<\/span>/);
});

test('parent categories reveal their populated subcategory navigation', () => {
  assert.match(page, /id="childrenCard"[^>]*style="display:none"/);
  assert.match(code, /if \(children\.length\) \{[\s\S]*childrenCard\.style\.display = ''/);
  assert.match(code, /postsCard\.style\.display = 'none'/);
});
