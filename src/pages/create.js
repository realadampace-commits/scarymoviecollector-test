import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { createOwnItem } from '../data/item-create.js';

let client;
const titleEl = document.getElementById('title');
const descEl = document.getElementById('desc');
const priceEl = document.getElementById('price');
const filesEl = document.getElementById('imgFiles');
const previews = document.getElementById('previews');
const createForm = document.getElementById('createForm');
const saveBtn = document.getElementById('saveBtn');
const msgEl = document.getElementById('msg');

function message(text, className = 'muted') {
  msgEl.className = className;
  msgEl.textContent = text;
}

filesEl.addEventListener('change', () => {
  previews.replaceChildren();
  for (const file of Array.from(filesEl.files).slice(0, 5)) {
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = '';
    image.style.cssText = 'width:120px;height:120px;object-fit:cover;border-radius:8px';
    previews.append(image);
  }
  if (filesEl.files.length > 5) message('Only the first 5 images will be used. Select at most 5 images.', 'err');
});

let session;
try {
  client = getSupabaseClient();
  session = await requireSession(client);
} catch {
  location.replace('login.html?next=create.html');
}

if (session) createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveBtn.disabled = true;
  message('Creating…');
  try {
    const item = await createOwnItem(client, session.user.id, {
      title: titleEl.value,
      description: descEl.value,
      userValue: priceEl.value,
      files: filesEl.files,
    });
    message('Created!', 'ok');
    location.href = `item.html?id=${encodeURIComponent(item.id)}`;
  } catch (error) {
    message(error.message || 'Unable to create item.', 'err');
    saveBtn.disabled = false;
  }
});
