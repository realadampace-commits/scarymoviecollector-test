import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../forum_post.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../src/pages/forum-post.js', import.meta.url), 'utf8');
const feedScript = await readFile(new URL('../src/pages/forum.js', import.meta.url), 'utf8');

test('reply composer has an accessible name and supporting hint', () => {
  assert.match(page, /<label for="rcText"[^>]*>Reply to this post<\/label>/);
  assert.match(page, /id="rcText"[^>]*aria-describedby="rcHint"/);
  assert.match(page, /id="rcHint"[^>]*>Share a helpful response/);
});

test('reply feedback is announced without interrupting the composer', () => {
  assert.match(script, /replyMsg\.setAttribute\('role', 'status'\)/);
  assert.match(script, /replyMsg\.setAttribute\('aria-live', 'polite'\)/);
});

test('reply loading and empty states are announced as one status region', () => {
  assert.match(page, /id="rStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test('reply composer prevents blank posts and exposes posting progress', () => {
  assert.match(page, /id="rcText"[^>]*required[^>]*minlength="1"/);
  assert.match(script, /const replyBody = replyText\.value\.trim\(\);/);
  assert.match(script, /Write a reply before posting\./);
  assert.match(script, /replySend\.textContent = 'Posting…';/);
  assert.match(script, /replySend\.setAttribute\('aria-busy', 'true'\)/);
});

test('inline forum comment composer has a persistent accessible label', () => {
  assert.match(feedScript, /<label class="sr-only">Write a comment<input/);
});

test('forum feed batches engagement instead of loading it once per card', () => {
  assert.match(feedScript, /getForumPostEngagement/);
  assert.doesNotMatch(feedScript, /async function postCard/);
  assert.doesNotMatch(feedScript, /recentPosts\.map\(\(post\) => postCard[\s\S]*Promise\.all/);
});

test('forum share controls only claim success after a clipboard write', () => {
  assert.match(feedScript, /if \(!navigator\.clipboard\?\.writeText\) throw new Error\('clipboard unavailable'\)/);
  assert.match(feedScript, /share\.textContent = 'Unable to copy link'/);
  assert.match(script, /shareBtn\.textContent = 'Unable to copy link'/);
});

test('post authors and admins receive a guarded delete action', () => {
  assert.match(script, /post\.author_id === session\.user\.id/);
  assert.match(script, /\['moderator', 'owner'\]\.includes\(viewerProfile\?\.role\)/);
  assert.match(script, /id="deletePostBtn"/);
  assert.match(script, /Delete this forum post and all of its replies\?/);
  assert.match(script, /deleteForumPost\(client, \{ postId: id, userId: session\.user\.id \}\)/);
  assert.match(script, /Unable to delete this post\. Refresh and try again\./);
});
