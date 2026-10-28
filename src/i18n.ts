/**
 * Idioma de la interfaz: español (el de siempre) o inglés. Los textos van en
 * línea con `L('español', 'english')`, sin claves: así el español sigue
 * leyéndose en el código. En el navegador el idioma se elige una vez al
 * cargar (cambiarlo recarga la página, para que Phaser redibuje todo); el
 * servidor lo fija por petición con `setLangProvider`.
 */

export type Lang = 'es' | 'en';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

const STORAGE_KEY = 'oficina-viva.lang';

/** Lo poco del navegador que se usa (este módulo también corre en el servidor, sin DOM). */
interface Browser {
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  navigator: { language: string };
  location: { reload(): void };
}
const browser = (globalThis as { window?: Browser }).window;

export function parseLang(v: unknown): Lang | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('en')) return 'en';
  return null;
}

function initialLang(): Lang {
  if (browser === undefined) return 'es';
  try {
    const saved = parseLang(browser.localStorage.getItem(STORAGE_KEY));
    if (saved !== null) return saved;
  } catch {
    // Sin acceso a localStorage (modo privado estricto): se usa el del navegador.
  }
  return parseLang(browser.navigator.language) ?? 'es';
}

const pageLang = initialLang();
let provider: () => Lang = () => pageLang;
let forced: Lang | null = null;

export function lang(): Lang {
  return forced ?? provider();
}

/** El servidor lo usa para responder en el idioma de cada petición. */
export function setLangProvider(fn: () => Lang): void {
  provider = fn;
}

/** Corre `fn` en un idioma fijo (p. ej. el texto de respaldo en español que se guarda). */
export function withLang<T>(l: Lang, fn: () => T): T {
  const prev = forced;
  forced = l;
  try {
    return fn();
  } finally {
    forced = prev;
  }
}

/** Elige el texto del idioma actual. */
export function L<T>(es: T, en: T): T {
  return lang() === 'en' ? en : es;
}

/** Locale para `Intl` (fechas, números). */
export function intlLocale(): string {
  return L('es-CL', 'en-US');
}

/** Cambia el idioma de la interfaz y recarga la página. */
export function setLang(l: Lang): void {
  if (l === pageLang || browser === undefined) return;
  try {
    browser.localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Si no se puede guardar, igual se recarga: quedará el idioma del navegador.
  }
  browser.location.reload();
}

/**
 * Para los catálogos (objetos, misiones, logros, salas…): cada entrada trae su
 * traducción en `en` y los campos traducidos pasan a ser getters que leen el
 * idioma actual. Así `def.name` sirve tal cual en el cliente y en el servidor.
 */
export function bilingual<T extends { en?: Partial<Record<string, string>> }>(list: T[]): T[] {
  for (const item of list) {
    const en = item.en;
    if (en === undefined) continue;
    for (const key of Object.keys(en)) {
      const es = (item as Record<string, unknown>)[key];
      const tr = en[key];
      Object.defineProperty(item, key, { enumerable: true, configurable: true, get: () => (lang() === 'en' && tr !== undefined ? tr : es) });
    }
  }
  return list;
}
