import { getSupabaseClient } from './src/supabase-client.js';

class AppMenu extends HTMLElement {
  static cache = null;

  async connectedCallback() {
    // fetch shared markup once
    if (!AppMenu.cache) {
      const res = await fetch('/menu.html', { cache: 'no-cache' });
      AppMenu.cache = await res.text();
    }

    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <svg aria-hidden="true" style="position:absolute;width:0;height:0"><symbol id="i-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></symbol><symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 3 3-2 2 2 2-3 3-2-2-3 3"/></symbol><symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.8M18 15c2 .6 3 2 3 4"/></symbol><symbol id="i-item" viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></symbol><symbol id="i-forum" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 13h5"/></symbol><symbol id="i-message" viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4z"/><path d="M8 9h8M8 12h5"/></symbol><symbol id="i-bag" viewBox="0 0 24 24"><path d="M5 8h14l1 13H4zM8 8a4 4 0 0 1 8 0"/></symbol><symbol id="i-add" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></symbol><symbol id="i-settings" viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12h-1m18 0h-1M12 4V3m0 18v-1M6.3 6.3l-.7-.7m13.1 13.1-.7-.7m0-12.4.7-.7M5.6 18.7l.7-.7"/></symbol><symbol id="i-exit" viewBox="0 0 24 24"><path d="M10 4H4v16h6M14 8l4 4-4 4M9 12h9"/></symbol></svg>
      <style>
        :host { position: fixed; top: 12px; right: 12px; z-index: 999; }
        .menu { position: relative; display:flex; align-items:flex-start; justify-content:center; }
        .hamburger {
          font-size: 20px; background:#222; color:#eee; border:1px solid #333;
          border-radius:10px; padding:8px 12px; cursor:pointer;
        }
        .drawer {
          position:absolute; top:48px; left:0;
          background:#1c1c1c; color:#eee; border-radius:14px;
          border:1px solid #2a2a2a; box-shadow:0 8px 20px rgba(0,0,0,.4);
          width:220px; padding:10px 0;
        }
        ul{list-style:none;margin:0;padding:0;}
        li{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;}
        li:hover{background:#232323;}
        a{text-decoration:none;color:#eee;display:flex;align-items:center;gap:10px;flex:1;}
        .ico{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;color:#f05a67;}
        .ico svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
        .active .ico{color:#ff9b63;}
        .active>a{font-weight:600;color:#fff;}
        .overlay{position:fixed;inset:0;background:transparent;display:none;}
        .overlay.show{display:block;}
        @media (max-width:700px) {
          :host { top:12px; right:12px; }
          .menu { height:auto; padding:0; }
          .hamburger { width:48px; height:48px; }
          .drawer { top:56px; bottom:auto; left:auto; right:0; }
        }
      </style>
      <div class="overlay"></div>
      ${AppMenu.cache}
    `;

    try {
      this.sb = getSupabaseClient();
    } catch (error) {
      console.warn('Menu auth state unavailable.', error);
      this.sb = null;
    }

    this._drawer = root.querySelector('#drawer');
    this._hamburger = root.querySelector('.hamburger');
    this._overlay = root.querySelector('.overlay');

    this._hamburger.addEventListener('click', () => this.toggle());
    this._overlay.addEventListener('click', () => this.close());
    this.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());

    this.highlightActive();
    this.close({ restoreFocus: false });
    this.checkAuth(); // show/hide proper items
  }

  open() {
    this._drawer.hidden = false;
    this._overlay.classList.add('show');
    this._hamburger.setAttribute('aria-expanded', 'true');
    this._hamburger.setAttribute('aria-label', 'Close menu');
    this._drawer.querySelector('a:not([hidden])')?.focus();
  }
  close({ restoreFocus = true } = {}) {
    this._drawer.hidden = true;
    this._overlay.classList.remove('show');
    this._hamburger.setAttribute('aria-expanded', 'false');
    this._hamburger.setAttribute('aria-label', 'Open menu');
    if (restoreFocus) this._hamburger.focus();
  }
  toggle() { this._drawer.hidden ? this.open() : this.close(); }

  highlightActive() {
    const links = this.shadowRoot.querySelectorAll('a[href]');
    const current = location.pathname.split('/').pop() || 'index.html';
    links.forEach(a => {
      const li = a.closest('li');
      li?.classList.toggle('active', a.getAttribute('href') === current);
    });
  }

  async checkAuth() {
    const onlyAuth = this.shadowRoot.querySelectorAll('.only-auth');
    const onlyGuest = this.shadowRoot.querySelectorAll('.only-guest');
    if (!this.sb) {
      onlyAuth.forEach(el=>el.style.display='none');
      onlyGuest.forEach(el=>el.style.display='flex');
      return;
    }
    try {
      const { data:{ session } } = await this.sb.auth.getSession();
      if (session) {
        onlyAuth.forEach(el=>el.style.display='flex');
        onlyGuest.forEach(el=>el.style.display='none');
        const logout = this.shadowRoot.getElementById('logoutLink');
        if (logout) logout.addEventListener('click', async (e)=>{
          e.preventDefault();
          await this.sb.auth.signOut();
          location.href = 'login.html';
        });
      } else {
        onlyAuth.forEach(el=>el.style.display='none');
        onlyGuest.forEach(el=>el.style.display='flex');
      }
    } catch(e){ console.error('Auth check error', e); }
  }
}
customElements.define('app-menu', AppMenu);
