import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = `${await readFile(new URL('../forum_new_post.html', import.meta.url), 'utf8')}\n${await readFile(new URL('../src/pages/forum-new-post.js', import.meta.url), 'utf8')}`;

test('new-post fields are labeled and required', () => {
  assert.match(page, /<label for="title">Title<\/label>/);
  assert.match(page, /<input id="title" name="title" required/);
  assert.match(page, /<label for="body"[^>]*>Body<\/label>/);
  assert.match(page, /<textarea id="body" name="body"[^>]*required/);
  assert.match(page, /id="title"[^>]*aria-describedby="postHelp"/);
  assert.match(page, /id="body"[^>]*aria-describedby="postHelp"/);
  assert.match(page, /<p id="postHelp"[^>]*>Both fields are required\./);
});

test('new-post feedback is announced as a live status', () => {
  assert.match(page, /<span id="msg"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('new-post creation stays unavailable until auth and role checks finish', () => {
  assert.match(page, /<button id="save" type="button" disabled aria-disabled="true">Create<\/button>/);
  assert.match(page, /saveBtn\.disabled = false;/);
  assert.match(page, /saveBtn\.removeAttribute\('aria-disabled'\);/);
});

test('new-post creation restores a retryable button after a failed request', () => {
  assert.match(page, /saveBtn\.disabled = true;\s*saveBtn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(page, /saveBtn\.disabled = false;\s*saveBtn\.removeAttribute\('aria-busy'\)/);
  assert.match(page, /Try again\.'\s*,\s*'err'/);
});

test('new-post authorization feedback is inline instead of blocking alerts', () => {
  assert.doesNotMatch(page, /alert\(/);
  assert.match(page, /msg\('Please sign in to create a post\. Redirecting to sign in…','err'\)/);
  assert.match(page, /msg\('Free members cannot create posts\. Return to the category to keep browsing\.',\s*'err'\)/);
});

