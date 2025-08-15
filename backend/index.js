// Backend inicial para xCopilot
require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Centralização de configurações
const config = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    port: PORT,
    env: process.env.NODE_ENV || 'development'
};

app.use(express.json());

// Healthcheck
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.env });
});

app.get('/', (_req, res) => {
    res.send('xCopilot backend rodando!');
});

// Exemplo de endpoint para testar acesso à configuração
app.get('/config', (_req, res) => {
    res.json({
        openaiApiKey: config.openaiApiKey ? 'OK' : 'NÃO DEFINIDA',
        port: config.port
    });
});

// Endpoint para gerar resposta via OpenAI
const { gerarResposta, OpenAIError } = require('./openai');
const { indexSnippet, searchSnippets } = require('./elasticsearch');
app.post('/openai', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }
    try {
        const resposta = await gerarResposta(prompt);
        res.json({ resposta });
    } catch (err) {
        if (err instanceof OpenAIError) {
            return res.status(err.status || 500).json({ error: err.message, code: err.code });
        }
        res.status(500).json({ error: 'Erro inesperado', detail: err.message });
    }
});

// Indexar snippet
app.post('/snippets', async (req, res) => {
    const { id, content, language } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content é obrigatório' });
    try {
        await indexSnippet({ id, content, language });
        res.status(201).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao indexar snippet', detail: err.message });
    }
});

// Buscar snippets
app.get('/snippets/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q é obrigatório' });
    try {
        const results = await searchSnippets(q);
        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: 'Falha na busca', detail: err.message });
    }
});

// Inicialização somente se executado diretamente
let server;
if (require.main === module) {
    server = app.listen(config.port, () => {
        console.log(`Servidor rodando na porta ${config.port}`);
    });
}

module.exports = { app, config };
