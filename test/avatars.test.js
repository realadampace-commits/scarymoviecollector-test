import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarObjectPath, validateAvatarFile } from '../src/data/avatars.js';

test('avatarObjectPath keeps each avatar under its owner directory', () => {
  assert.match(avatarObjectPath('user-1', 'image/png'), /^user-1\/avatar-\d+\.png$/);
});

test('validateAvatarFile accepts small supported images', () => {
  assert.doesNotThrow(() => validateAvatarFile({ type: 'image/jpeg', size: 1024 }));
});

test('validateAvatarFile rejects missing, oversized, and unsupported files', () => {
  assert.throws(() => validateAvatarFile(null), /image is required/);
  assert.throws(() => validateAvatarFile({ type: 'image/svg+xml', size: 100 }), /PNG, JPEG, WebP, or GIF/);
  assert.throws(() => validateAvatarFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), /5 MB/);
});
