import { isPasswordRecoveryEvent, resetPassword } from '../auth.js';
import { getSupabaseClient } from '../supabase-client.js';

const client = getSupabaseClient();
const firstPassword = document.getElementById('pwd1');
const secondPassword = document.getElementById('pwd2');
const saveButton = document.getElementById('save');
const message = document.getElementById('msg');
let recoveryVerified = false;

const setMessage = (text, kind = '') => {
  message.className = `msg ${kind}`;
  message.textContent = text;
};
const setFormEnabled = (enabled) => {
  firstPassword.disabled = !enabled;
  secondPassword.disabled = !enabled;
  saveButton.disabled = !enabled;
};

setFormEnabled(false);
setMessage('Verifying your reset link…');
client.auth.onAuthStateChange((event, session) => {
  if (isPasswordRecoveryEvent(event) && session) {
    recoveryVerified = true;
    setFormEnabled(true);
    setMessage('Choose a new password.');
  }
});

setTimeout(() => {
  if (!recoveryVerified) setMessage('This password-reset link is invalid or expired. Request a new one from sign in.', 'err');
}, 1000);

saveButton.addEventListener('click', async () => {
  if (!recoveryVerified) return;
  setFormEnabled(false);
  setMessage('Saving new password…');
  try {
    await resetPassword(client, firstPassword.value, secondPassword.value);
    setMessage('Password updated. Redirecting to sign in…', 'ok');
    setTimeout(() => { location.href = 'login.html'; }, 1000);
  } catch (error) {
    setMessage(error.message || 'Unable to update password.', 'err');
    setFormEnabled(true);
  }
});
