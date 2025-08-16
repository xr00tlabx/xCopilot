// Módulo para integração com OpenAI (SDK v5)
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

async function gerarResposta(prompt) {
    try {
        const completion = await getClient().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }]
        });
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

        const completion = await getClient().chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
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
