import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../item.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../src/pages/item.js', import.meta.url), 'utf8');

test('item gallery exposes keyboard-accessible thumbnails and modal semantics', () => {
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /id="mainImg" role="button" tabindex="0"/);
  assert.match(script, /<button type="button" aria-label="View image/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /event\.key === 'ArrowLeft'/);
  assert.match(script, /event\.key === 'ArrowRight'/);
});

test('item gallery removes viewer semantics when an item has no images', () => {
  assert.match(script, /if \(!images\.length\) \{[\s\S]*main\.removeAttribute\('role'\)[\s\S]*main\.removeAttribute\('tabindex'\)[\s\S]*main\.removeAttribute\('aria-label'\)/);
  assert.match(html, /\.mainImg\.no-image\{cursor:default\}/);
});

test('item lightbox removes inactive previous and next controls for single-image items', () => {
  assert.match(script, /const updateLightboxNavigation = \(\) => \{/);
  assert.match(script, /const hasMultipleImages = images\.length > 1/);
  assert.match(script, /previousButton\.disabled = !hasMultipleImages/);
  assert.match(script, /nextButton\.disabled = !hasMultipleImages/);
  assert.match(script, /previousButton\.setAttribute\('aria-hidden', String\(!hasMultipleImages\)\)/);
  assert.match(script, /nextButton\.setAttribute\('aria-hidden', String\(!hasMultipleImages\)\)/);
});

test('item lightbox keeps Tab focus inside the dialog controls', () => {
  assert.match(script, /event\.key !== 'Tab'/);
  assert.match(script, /event\.shiftKey && document\.activeElement === first/);
  assert.match(script, /document\.activeElement === last/);
  assert.match(script, /last\.focus\(\)/);
  assert.match(script, /first\.focus\(\)/);
});

test('item lightbox restores focus to the gallery trigger when closed', () => {
  assert.match(script, /const closeLightbox = \(\) => \{ overlay\.style\.display = 'none'; main\.focus\(\); \}/);
});

test('guest login link preserves the current item context', () => {
  assert.match(script, /loginLink/);
  assert.match(script, /item\.html\?id=\$\{encodeURIComponent\(id\)\}/);
});

test('item purchase UI is removed while vote feedback remains announced', () => {
  assert.doesNotMatch(html, /buyCard|buyBtn|buyMsg|USDC|payment/);
  assert.match(html, /id="voteMsg"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('item vote submission prevents duplicate saves while a request is pending', () => {
  assert.match(script, /const saveSuggestionButton = document\.getElementById\('saveSuggestion'\)/);
  assert.match(script, /saveSuggestionButton\.disabled = true;[\s\S]*voteMsg\.textContent = 'Saving vote…'/);
  assert.match(script, /finally \{ saveSuggestionButton\.disabled = false; \}/);
});

test('agree votes keep an actionable save control visible', () => {
  assert.match(html, /id="disagreeBlock"[\s\S]*?<\/div>\s*<button id="saveSuggestion"/);
  assert.match(script, /document\.getElementById\('disagreeBlock'\)\.style\.display = agree \? 'none' : 'flex';/);
});

test('item vote submission refreshes displayed vote totals', () => {
  assert.match(script, /await saveItemVote[\s\S]*renderVoteSummary\(await getItemVotes\(client, id\)\)/);
});

test('item deletion exposes non-blocking progress and error feedback', () => {
  assert.match(html, /id="deleteMsg"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(script, /deleteMsg\.textContent = 'Deleting item…'/);
  assert.match(script, /deleteMsg\.textContent = error\.message \|\| 'Unable to delete item\. Try again\.'/);
  assert.doesNotMatch(script, /alert\(error\.message \|\| 'Unable to delete item\.'\)/);
});

 test('vote choices expose their selected state to assistive technology', () => {
  assert.match(html, /id="agreeBtn"[^>]*aria-pressed="false"/);
  assert.match(html, /id="disagreeBtn"[^>]*aria-pressed="false"/);
  assert.match(script, /setAttribute\('aria-pressed', String\(agree\)\)/);
  assert.match(script, /setAttribute\('aria-pressed', String\(!agree\)\)/);
});