const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

let skipGeminiUntil = 0;
let skipOpenAIUntil = 0;

function trimKey(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function getGeminiKey() {
  const key = trimKey(process.env.GEMINI_API_KEY);
  if (!key || key === 'your_gemini_api_key_here' || key === 'your_gemini_api_key') return '';
  return key;
}

function getOpenAIKey() {
  const key = trimKey(process.env.OPENAI_API_KEY);
  if (!key || key === 'your_openai_api_key_here') return '';
  return key;
}

function isGeminiKeyError(error) {
  const msg = error?.message || '';
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('API_KEY')
  );
}

async function generateWithGemini(prompt, { temperature, maxOutputTokens }) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Gemini API not configured');
  if (Date.now() < skipGeminiUntil) {
    throw new Error('Gemini temporarily skipped after invalid key');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature,
      maxOutputTokens,
      topP: 0.9
    }
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text || !text.trim()) {
    throw new Error('Empty response from Gemini');
  }
  return text;
}

async function generateWithOpenAI(prompt, { json, temperature, maxOutputTokens, systemInstruction }) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error('OpenAI API not configured');
  if (Date.now() < skipOpenAIUntil) {
    throw new Error('OpenAI temporarily skipped after billing/auth error');
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature,
    max_tokens: Math.min(maxOutputTokens, 16384),
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      {
        role: 'system',
        content: systemInstruction || (json ? 'Return valid JSON only. No markdown.' : 'You are a helpful assistant.')
      },
      { role: 'user', content: prompt }
    ]
  });

  const text = completion.choices[0]?.message?.content || '';
  if (!text.trim()) {
    throw new Error('Empty response from OpenAI');
  }
  return text;
}

/**
 * Generate model text. Tries Gemini first, then OpenAI if the Gemini key is invalid/missing.
 */
async function generateText(prompt, options = {}) {
  const temperature = options.temperature ?? 0.4;
  const maxOutputTokens = options.maxOutputTokens ?? 4096;
  const json = options.json === true;
  const systemInstruction = options.systemInstruction || '';
  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;

  const geminiKey = getGeminiKey();
  const openaiKey = getOpenAIKey();

  if (geminiKey && Date.now() >= skipGeminiUntil) {
    try {
      return await generateWithGemini(fullPrompt, { temperature, maxOutputTokens });
    } catch (error) {
      if (isGeminiKeyError(error)) {
        skipGeminiUntil = Date.now() + 60 * 60 * 1000;
        console.warn('[LLM] Gemini API key rejected; falling back to OpenAI');
      } else if (!openaiKey) {
        throw error;
      } else {
        console.warn('[LLM] Gemini failed, trying OpenAI:', (error.message || '').slice(0, 180));
      }
    }
  }

  if (openaiKey && Date.now() >= skipOpenAIUntil) {
    try {
      return await generateWithOpenAI(prompt, {
        json,
        temperature,
        maxOutputTokens,
        systemInstruction
      });
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('429') || msg.includes('no credits') || msg.includes('insufficient_quota') || msg.includes('invalid_api_key')) {
        skipOpenAIUntil = Date.now() + 60 * 60 * 1000;
        console.warn('[LLM] OpenAI unavailable; using source extraction');
      }
      throw error;
    }
  }

  throw new Error('No working Gemini or OpenAI API key configured');
}

module.exports = { generateText };
