const { GoogleGenerativeAI } = require('@google/generative-ai');

let skipGeminiUntil = 0;

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.0-flash-001'
];

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
  const ordered = [preferred, configuredModel(), ...MODEL_FALLBACKS];
  return [...new Set(ordered.filter(Boolean))];
}

function isGeminiKeyError(error) {
  const msg = error?.message || '';
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('API_KEY')
  );
}

function isMissingModelError(error) {
  const msg = error?.message || '';
  return (
    msg.includes('404') ||
    msg.includes('Not Found') ||
    msg.includes('not found') ||
    msg.includes('is not found for API version')
  );
}

async function generateWithGemini(prompt, { temperature, maxOutputTokens, json, model: modelName }) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API not configured');
  if (Date.now() < skipGeminiUntil) {
    throw new Error('Gemini temporarily skipped after invalid key');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig = {
    temperature,
    maxOutputTokens,
    topP: 0.9,
    ...(json ? { responseMimeType: 'application/json' } : {})
  };

  let lastError;
  for (const name of modelList(modelName)) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text || !text.trim()) {
        throw new Error('Empty response from Gemini');
      }
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
      if (isMissingModelError(error)) {
        console.warn(`[LLM] Gemini model ${name} unavailable, trying next`);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('No working Gemini model');
}

/**
 * Generate model text with Gemini only. No OpenAI fallback.
 */
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
