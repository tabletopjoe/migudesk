/** MyMemory public API — no key; fair-use limits apply (~500 chars per request). */
const MYMEMORY_MAX_LEN = 500;

export async function translateEnglishToAll(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('text is required');
  }
  if (trimmed.length > MYMEMORY_MAX_LEN) {
    throw new Error(`Text must be ${MYMEMORY_MAX_LEN} characters or less`);
  }

  const targets = ['es', 'it', 'fr', 'pt', 'de'];
  const translations = { en: trimmed };

  await Promise.all(
    targets.map(async (lang) => {
      const q = encodeURIComponent(trimmed);
      const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=en|${lang}`;
      const r = await fetch(url);
      const data = await r.json().catch(() => ({}));
      if (data.quotaFinished) {
        throw new Error('Translation quota exceeded. Try again later.');
      }
      const out = data.responseData?.translatedText;
      translations[lang] = typeof out === 'string' && out.trim() ? out.trim() : '—';
    }),
  );

  return translations;
}
