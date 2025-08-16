// Módulo para integração com OpenAI (SDK v5) com retry e fallback de modelo
const OpenAI = require('openai');

class OpenAIError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'OpenAIError';
        this.status = status;
        this.code = code;
    }
}

let client;
function getClient() {
    if (!client) {
        if (!process.env.OPENAI_API_KEY) {
            throw new OpenAIError('OPENAI_API_KEY não definida', 500, 'NO_API_KEY');
        }
        client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return client;
}

// Configuração com defaults e possibilidade de override via env
const MODEL_PRIMARY = process.env.OPENAI_PRIMARY_MODEL || 'gpt-4o-mini';
const MODEL_FALLBACK = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
const MAX_RETRIES = parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10);
const RETRY_BASE_MS = parseInt(process.env.OPENAI_RETRY_BASE_MS || '500', 10); // backoff inicial
const ENABLE_MODEL_FALLBACK = (process.env.OPENAI_ENABLE_MODEL_FALLBACK || 'true').toLowerCase() === 'true';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shouldRetry(err, attempt) {
    if (attempt >= MAX_RETRIES) return false;
    const status = err?.status || err?.response?.status;
    // Não retry em erros de autenticação ou requisição inválida
    if (status === 400 || status === 401 || status === 403) return false;
    // Rate limit ou erros de servidor / rede
    if (status === 408 || status === 409 || status === 429 || (status >= 500)) return true;
    // Erros sem status (rede, timeout baixo nível)
    const code = err?.code || '';
    if (['ETIMEDOUT','ECONNRESET','EAI_AGAIN','ENOTFOUND'].includes(code)) return true;
    return false;
}

async function callWithRetry(model, messages, options = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const completion = await getClient().chat.completions.create({
                model,
                messages,
                ...options
            });
            return completion;
        } catch (err) {
            lastErr = err;
            if (!shouldRetry(err, attempt)) break;
            const delay = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            if (process.env.DEBUG_OPENAI === '1') {
                console.warn(`[openai] tentativa ${attempt + 1} falhou para modelo ${model} (status=${err.status || err.code}); retry em ${delay}ms`);
            }
            await sleep(delay);
        }
    }
    throw lastErr;
}

async function callChatWithFallback(messages, options = {}) {
    try {
        return await callWithRetry(MODEL_PRIMARY, messages, options);
    } catch (primaryErr) {
        if (ENABLE_MODEL_FALLBACK) {
            if (process.env.DEBUG_OPENAI === '1') {
                console.warn(`[openai] fallback para modelo secundário ${MODEL_FALLBACK} devido a erro primário: ${primaryErr.status || primaryErr.code}`);
            }
            try {
                return await callWithRetry(MODEL_FALLBACK, messages, options);
            } catch (fallbackErr) {
                // Anexa informação do fallback
                fallbackErr.primaryError = primaryErr;
                throw fallbackErr;
            }
        }
        throw primaryErr;
    }
}

async function gerarResposta(prompt) {
    try {
        const completion = await callChatWithFallback([
            { role: 'user', content: prompt }
        ]);
        return completion.choices?.[0]?.message?.content || '';
    } catch (err) {
        // Sanitiza e reclassifica erro
        const status = err.status || err.response?.status || 500;
        const code = err.error?.type || err.code || (status === 401 ? 'AUTH_ERROR' : 'OPENAI_ERROR');
        let message;
        if (status === 401) {
            message = 'Falha de autenticação com OpenAI (verifique API key).';
        } else if (status === 429) {
            message = 'Limite de requisições atingido (rate limit).';
        } else if (status >= 500) {
            message = 'Serviço OpenAI indisponível no momento.';
        } else {
            message = 'Erro ao consultar OpenAI.';
        }
        throw new OpenAIError(message, status, code);
    }
}

// Optimized completion function for inline code completion
async function gerarCompletion({ prompt, context, language, textBefore, textAfter, maxTokens = 50, temperature = 0.3 }) {
    try {
        // Build optimized system prompt for code completion
        const systemPrompt = `You are an expert code completion assistant. Complete the code accurately and concisely.

Language: ${language || 'unknown'}
Context: ${context || 'none'}

Rules:
1. Only complete the missing code, no explanations
2. Keep the same coding style and conventions
3. Maximum 1-2 lines of completion
4. If unsure, provide a simple logical completion
5. Maintain proper indentation
6. Return ONLY the completion text`;

        const userPrompt = `Code before cursor: "${textBefore}"
Code after cursor: "${textAfter}"

${prompt}

Complete the code:`;

        const completion = await callChatWithFallback([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], {
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
        });

        const result = completion.choices?.[0]?.message?.content || '';
        
        // Clean up the response
        let cleanResult = result.trim();
        
        // Remove code blocks if present
        cleanResult = cleanResult.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        
        // Limit to first 2 lines max
        const lines = cleanResult.split('\n').slice(0, 2);
        cleanResult = lines.join('\n');
        
        return cleanResult;

    } catch (err) {
        // Same error handling as gerarResposta
        const status = err.status || err.response?.status || 500;
        const code = err.error?.type || err.code || (status === 401 ? 'AUTH_ERROR' : 'OPENAI_ERROR');
        let message;
        if (status === 401) {
            message = 'Falha de autenticação com OpenAI (verifique API key).';
        } else if (status === 429) {
            message = 'Limite de requisições atingido (rate limit).';
        } else if (status >= 500) {
            message = 'Serviço OpenAI indisponível no momento.';
        } else {
            message = 'Erro ao consultar OpenAI.';
        }
        throw new OpenAIError(message, status, code);
    }
}

module.exports = { gerarResposta, gerarCompletion, client, OpenAIError };
