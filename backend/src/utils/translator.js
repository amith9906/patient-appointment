const LANGUAGE_MAP = {
  en: 'English',
  kn: 'Kannada',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  ml: 'Malayalam',
  mr: 'Marathi',
  mwr: 'Marwadi',
};

const SUPPORTED_LANGUAGE_CODES = Object.keys(LANGUAGE_MAP);

const PROVIDER_CODE_MAP = {
  mwr: 'hi', // fallback for providers that do not directly support Marwadi
};

function resolveProviderCode(code) {
  return PROVIDER_CODE_MAP[code] || code;
}

async function translateViaLibreTranslate({ text, target, source = 'auto' }) {
  const url = process.env.TRANSLATE_API_URL || 'https://libretranslate.com/translate';
  const payload = {
    q: text,
    source,
    target: resolveProviderCode(target),
    format: 'text',
  };
  if (process.env.TRANSLATE_API_KEY) payload.api_key = process.env.TRANSLATE_API_KEY;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Translation provider error (${response.status}): ${errText || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data || typeof data.translatedText !== 'string') {
    throw new Error('Invalid translation response');
  }
  return data.translatedText;
}

async function translateTextToLanguages({ text, targetLanguages = [], sourceLanguage = 'auto' }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Text is required for translation');

  const selected = Array.from(new Set(
    (targetLanguages || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
  ));
  const validTargets = selected.filter((code) => SUPPORTED_LANGUAGE_CODES.includes(code));
  if (validTargets.length === 0) throw new Error('At least one valid target language is required');

  const translations = {};
  const failures = [];

  await Promise.all(validTargets.map(async (langCode) => {
    try {
      translations[langCode] = await translateViaLibreTranslate({
        text: trimmed,
        target: langCode,
        source: sourceLanguage || 'auto',
      });
    } catch (err) {
      failures.push({ language: langCode, message: err.message });
    }
  }));

  return { translations, failures };
}

module.exports = {
  LANGUAGE_MAP,
  SUPPORTED_LANGUAGE_CODES,
  translateTextToLanguages,
};
