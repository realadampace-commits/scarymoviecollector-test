import { resetPassword } from '../auth.js';
import { getSupabaseClient } from '../supabase-client.js';

const client = getSupabaseClient();
const firstPassword = document.getElementById('pwd1');
const secondPassword = document.getElementById('pwd2');
const saveButton = document.getElementById('save');
const message = document.getElementById('msg');

const setMessage = (text, kind = '') => {
  message.className = `msg ${kind}`;
  message.textContent = text;
};

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  firstPassword.disabled = true;
  secondPassword.disabled = true;
  setMessage('Saving new password…');
  try {
    await resetPassword(client, firstPassword.value, secondPassword.value);
    setMessage('Password updated. Redirecting to sign in…', 'ok');
    setTimeout(() => { location.href = 'login.html'; }, 1000);
  } catch (error) {
    setMessage(error.message || 'Unable to update password.', 'err');
    saveButton.disabled = false;
    firstPassword.disabled = false;
    secondPassword.disabled = false;
  }
});
