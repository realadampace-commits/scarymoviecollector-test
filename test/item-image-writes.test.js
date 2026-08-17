import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageUploadPlan } from '../src/data/item-image-writes.js';

test('validateImageUploadPlan enforces image type and five-image cap', () => {
  assert.deepEqual(validateImageUploadPlan(2, [{ name: 'a.png', type: 'image/png', size: 10 }]), [{ name: 'a.png', type: 'image/png', size: 10 }]);
  assert.throws(() => validateImageUploadPlan(5, [{ name: 'a.png', type: 'image/png', size: 10 }]), /maximum/);
  assert.throws(() => validateImageUploadPlan(0, [{ name: 'a.txt', type: 'text/plain', size: 10 }]), /image files/);
});

test('validateImageUploadPlan rejects invalid inputs', () => {
  assert.throws(() => validateImageUploadPlan(-1, []), /count/);
  assert.throws(() => validateImageUploadPlan(0, null), /array/);
});
