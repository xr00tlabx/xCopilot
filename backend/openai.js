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

// Multi-line code generation function for complex implementations
async function gerarMultilineCode({ prompt, type, language, context, maxTokens = 300, temperature = 0.4 }) {
    try {
        // Build specialized system prompt based on generation type
        let systemPrompt = `You are an expert ${language || 'code'} developer. Generate complete, production-ready code implementations.`;
        
        switch (type) {
            case 'function':
                systemPrompt += `\n\nRules for function generation:
1. Implement complete function body based on JSDoc/comments
2. Include proper error handling
3. Use appropriate data types and return values
4. Follow best practices for ${language}
5. Include helpful comments for complex logic`;
                break;
                
            case 'implementation':
                systemPrompt += `\n\nRules for TODO/FIXME implementation:
1. Analyze the TODO/FIXME comment thoroughly
2. Implement the missing functionality completely
3. Consider edge cases and error conditions
4. Use existing code patterns from context
5. Maintain code style consistency`;
                break;
                
            case 'interface':
                systemPrompt += `\n\nRules for interface implementation:
1. Implement all required interface methods
2. Provide meaningful default implementations
3. Include proper type annotations
4. Follow interface contracts strictly
5. Add documentation for each method`;
                break;
                
            case 'class':
                systemPrompt += `\n\nRules for class implementation:
1. Generate complete class skeleton with constructor
2. Include common methods (toString, equals if applicable)
3. Add proper access modifiers
4. Include instance variables as needed
5. Follow ${language} class conventions`;
                break;
                
            default:
                systemPrompt += `\n\nGenerate complete, working code that fulfills the requirements.`;
        }

        systemPrompt += `\n\nLanguage: ${language || 'unknown'}
Context: ${context ? 'Available' : 'Limited'}

IMPORTANT: 
- Return ONLY the code implementation, no explanations
- Ensure code is properly formatted and indented
- Include only necessary comments
- Code should be ready to use immediately`;

        const userPrompt = `Generate ${type} implementation for:\n\n${prompt}\n\n${context ? `Context:\n${context}\n\n` : ''}Generate the code:`;

        const completion = await callChatWithFallback(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            {
                max_tokens: maxTokens,
                temperature: temperature,
                top_p: 0.95,
                frequency_penalty: 0.2,
                presence_penalty: 0.1
            }
        );

        let result = completion.choices?.[0]?.message?.content || '';
        
        // Clean up the response
        result = result.trim();
        
        // Remove code blocks if present
        result = result.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        
        // Ensure proper indentation (basic cleanup)
        const lines = result.split('\n');
        const cleanedLines = lines.map(line => line.trimEnd());
        result = cleanedLines.join('\n');
        
        return result;

    } catch (err) {
        // Same error handling as other functions
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

module.exports = { gerarResposta, gerarCompletion, gerarMultilineCode, client, OpenAIError };
