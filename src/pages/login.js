import { getSupabaseClient } from './supabase-client.js';
import { getSession, signInWithPassword, signUpWithPassword } from './auth.js';

const client = getSupabaseClient();
const email = document.getElementById('email');
const password = document.getElementById('password');
const msg = document.getElementById('msg');
const buttons = [document.getElementById('signup'), document.getElementById('signin')];
const nextUrl = new URLSearchParams(location.search).get('next') || 'portfolio.html';
const setMsg = (text, kind = '') => { msg.className = `msg ${kind}`; msg.textContent = text; };
const setBusy = (busy) => { buttons.forEach((button) => { button.disabled = busy; }); email.disabled = busy; password.disabled = busy; };

if (await getSession(client)) {
  setMsg('You are signed in. Redirecting…', 'ok');
  setTimeout(() => { location.href = nextUrl; }, 300);
}

document.getElementById('signup').addEventListener('click', async () => {
  setBusy(true); setMsg('Creating account…');
  try { await signUpWithPassword(client, email.value, password.value); setMsg('Check your email to confirm your account.', 'ok'); }
  catch (error) { setMsg(error.message || 'Sign-up failed.', 'err'); }
  finally { setBusy(false); }
});

document.getElementById('signin').addEventListener('click', async () => {
  setBusy(true); setMsg('Signing in…');
  try { await signInWithPassword(client, email.value, password.value); setMsg('Signed in. Redirecting…', 'ok'); setTimeout(() => { location.href = nextUrl; }, 300); }
  catch (error) { setMsg(error.message || 'Sign-in failed.', 'err'); }
  finally { setBusy(false); }
});
