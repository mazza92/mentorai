const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.0-flash'
];

let skipGeminiUntil = 0;

function trimKey(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function getGeminiKey() {
  const key = trimKey(process.env.GEMINI_API_KEY);
  if (!key || key === 'your_gemini_api_key_here' || key === 'your_gemini_api_key') return '';
  return key;
}

function configuredModel() {
  return trimKey(process.env.GEMINI_MODEL) || DEFAULT_MODEL;
}

function modelList(preferred) {
  return [...new Set([preferred, configuredModel(), ...MODEL_FALLBACKS].filter(Boolean))];
}

function isGeminiKeyError(error) {
  const msg = error?.message || '';
  return msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('API_KEY');
}

function isMissingModelError(error) {
  const msg = error?.message || '';
  return msg.includes('404') || msg.includes('Not Found') || msg.includes('not found') || msg.includes('is not found for API version');
}

function isJsonModeError(error) {
  const msg = error?.message || '';
  return msg.includes('JSON mode') || msg.includes('responseMimeType') || msg.includes('api version v1');
}

async function callGemini(apiKey, model, prompt, { temperature, maxOutputTokens, json }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig = {
    temperature,
    maxOutputTokens,
    topP: 0.9
  };
  if (json) generationConfig.responseMimeType = 'application/json';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    })
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`[Gemini ${res.status}] ${msg}`);
  }

  const text = (data?.candidates || [])
    .flatMap((c) => c?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function generateWithGemini(prompt, { temperature, maxOutputTokens, json, model: modelName }) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API not configured');
  if (Date.now() < skipGeminiUntil) {
    throw new Error('Gemini temporarily skipped after invalid key');
  }

  let lastError;
  for (const name of modelList(modelName)) {
    try {
      const text = await callGemini(apiKey, name, prompt, {
        temperature,
        maxOutputTokens,
        json
      });
      if (name !== (modelName || configuredModel())) {
        console.warn(`[LLM] Using Gemini model ${name}`);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (isGeminiKeyError(error)) {
        skipGeminiUntil = Date.now() + 60 * 60 * 1000;
        throw error;
      }
      if (json && isJsonModeError(error)) {
        console.warn(`[LLM] JSON mime rejected on ${name}, retrying as text JSON`);
        try {
          return await callGemini(apiKey, name, prompt, {
            temperature,
            maxOutputTokens,
            json: false
          });
        } catch (retryError) {
          lastError = retryError;
        }
      }
      if (isMissingModelError(error)) {
        console.warn(`[LLM] Gemini model ${name} unavailable, trying next`);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('No working Gemini model');
}

async function generateText(prompt, options = {}) {
  const temperature = options.temperature ?? 0.4;
  const maxOutputTokens = options.maxOutputTokens ?? 4096;
  const json = options.json === true;
  const model = options.model || configuredModel();
  const systemInstruction = options.systemInstruction || '';
  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;

  if (!getGeminiKey()) {
    throw new Error('No working Gemini API key configured');
  }

  return generateWithGemini(fullPrompt, { temperature, maxOutputTokens, json, model });
}

module.exports = { generateText };
