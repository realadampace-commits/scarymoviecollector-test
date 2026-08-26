import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readPage = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('item search loads the configured application client instead of an empty CDN client', async () => {
  const page = await readPage('item-search.html');
  assert.doesNotMatch(page, /cdn\.jsdelivr\.net\/npm\/@supabase/);
  assert.match(page, /<script type="module" src="\/src\/pages\/item-search\.js"><\/script>/);
});

test('new forum posts load the configured application client instead of an empty CDN client', async () => {
  const page = await readPage('forum_new_post.html');
  assert.doesNotMatch(page, /cdn\.jsdelivr\.net\/npm\/@supabase/);
  assert.match(page, /<script type="module" src="\/src\/pages\/forum-new-post\.js"><\/script>/);
});

test('public profiles do not load a redundant global Supabase client', async () => {
  const page = await readPage('user.html');
  assert.doesNotMatch(page, /cdn\.jsdelivr\.net\/npm\/@supabase/);
});
