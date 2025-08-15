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

module.exports = { gerarResposta, client, OpenAIError };
