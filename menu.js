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
        .ico{width:22px;text-align:center;opacity:.9;}
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
    this.close();
    this.checkAuth(); // show/hide proper items
  }

  open() {
    this._drawer.hidden = false;
    this._overlay.classList.add('show');
    this._hamburger.setAttribute('aria-expanded', 'true');
  }
  close() {
    this._drawer.hidden = true;
    this._overlay.classList.remove('show');
    this._hamburger.setAttribute('aria-expanded', 'false');
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
