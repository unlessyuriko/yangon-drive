export type Lang = 'en' | 'my';

const KEY = 'yd.lang';
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

let lang: Lang = (safeGet(KEY) as Lang | null) ?? (navigator.language?.toLowerCase().startsWith('my') ? 'my' : 'en');
if (lang !== 'en' && lang !== 'my') lang = 'en';
const listeners: ((l: Lang) => void)[] = [];

export const getLang = () => lang;
export const onLang = (cb: (l: Lang) => void) => { listeners.push(cb); };
/** pick the text for the current language */
export const tr = (en: string, my: string) => (lang === 'my' && my ? my : en);

/** fill every element that carries data-en / data-my */
export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-en]').forEach((e) => { e.textContent = tr(e.dataset.en ?? '', e.dataset.my ?? ''); });
  document.querySelectorAll<HTMLElement>('#s-lang button').forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
}

export function setLang(l: Lang) {
  lang = l; safeSet(KEY, l); applyStatic();
  listeners.forEach((cb) => cb(l));
}

/** wire the settings button and dialog */
export function initSettings() {
  const dlg = document.getElementById('settings')!;
  const open = (v: boolean) => { dlg.style.display = v ? 'flex' : 'none'; };
  const gear = document.getElementById('bSettings')!;
  gear.addEventListener('pointerdown', (e) => { e.stopPropagation(); open(true); });
  document.getElementById('s-close')!.addEventListener('click', () => open(false));
  dlg.addEventListener('pointerdown', (e) => { if (e.target === dlg) open(false); });
  document.querySelectorAll<HTMLElement>('#s-lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.l as Lang)));
  addEventListener('keydown', (e) => { if (e.code === 'Escape') open(dlg.style.display !== 'flex'); });
  applyStatic();
}
