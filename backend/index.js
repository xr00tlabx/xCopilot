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
const { gerarResposta, gerarCompletion, OpenAIError } = require('./openai');
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

// Otimized completion endpoint for inline code completion
// Simple cache for completions
const completionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

function getCachedCompletion(key) {
    const cached = completionCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        completionCache.delete(key);
        return null;
    }
    
    return cached.completion;
}

function setCachedCompletion(key, completion) {
    // Clean old entries if cache is too big
    if (completionCache.size >= MAX_CACHE_SIZE) {
        const firstKey = completionCache.keys().next().value;
        completionCache.delete(firstKey);
    }
    
    completionCache.set(key, {
        completion,
        timestamp: Date.now()
    });
}

app.post('/api/completion', async (req, res) => {
    const { context, language, prompt, textBefore, textAfter } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    try {
        const startTime = Date.now();
        
        // Generate cache key
        const cacheKey = `${language}:${textBefore}:${textAfter}`;
        
        // Check cache first
        const cachedResult = getCachedCompletion(cacheKey);
        if (cachedResult) {
            const duration = Date.now() - startTime;
            return res.json({ 
                completion: cachedResult,
                duration,
                cached: true
            });
        }
        
        // Use specialized completion function for better performance
        const completion = await gerarCompletion({
            prompt,
            context,
            language,
            textBefore,
            textAfter,
            maxTokens: 50, // Limit tokens for inline completion
            temperature: 0.3 // Lower temperature for more predictable code
        });
        
        // Cache the result
        setCachedCompletion(cacheKey, completion);
        
        const duration = Date.now() - startTime;
        
        res.json({ 
            completion,
            duration,
            cached: false
        });
        
    } catch (err) {
        if (err instanceof OpenAIError) {
            return res.status(err.status || 500).json({ error: err.message, code: err.code });
        }
        res.status(500).json({ error: 'Erro inesperado', detail: err.message });
    }
});

// Enhanced code generation endpoint for multi-line code generation
app.post('/api/generate', async (req, res) => {
    const { input, type, language, context, variables } = req.body;
    
    if (!input || !type || !language) {
        return res.status(400).json({ 
            error: 'input, type, and language são obrigatórios.' 
        });
    }

    try {
        const startTime = Date.now();
        
        // Build specialized prompt based on generation type
        const prompt = buildGenerationPrompt(input, type, language, context, variables);
        
        // Use enhanced completion function with longer token limit
        const generatedCode = await gerarResposta(prompt);
        
        const duration = Date.now() - startTime;
        
        res.json({ 
            code: generatedCode,
            type,
            language,
            duration,
            metadata: {
                inputType: type,
                contextProvided: !!context,
                variablesUsed: !!variables
            }
        });
        
    } catch (err) {
        if (err instanceof OpenAIError) {
            return res.status(err.status || 500).json({ error: err.message, code: err.code });
        }
        res.status(500).json({ error: 'Erro inesperado', detail: err.message });
    }
});

// Helper function to build generation prompts
function buildGenerationPrompt(input, type, language, context, variables) {
    const contextInfo = context ? `
Contexto do arquivo:
- Arquivo: ${context.fileName || 'desconhecido'}
- Linguagem: ${language}
- Imports: ${context.imports?.join(', ') || 'nenhum'}
- Funções existentes: ${context.functions?.join(', ') || 'nenhum'}` : '';

    const variableInfo = variables ? `
Variáveis do template:
${Object.entries(variables).map(([key, value]) => `- ${key}: ${value}`).join('\n')}` : '';

    const prompts = {
        comment: `
Analise o seguinte comentário e gere a implementação completa em ${language}:

Comentário:
${input}
${contextInfo}

Gere APENAS o código de implementação, sem explicações. 
Use boas práticas e inclua documentação apropriada.`,

        interface: `
Implemente a seguinte interface completa em ${language}:

Interface:
\`\`\`${language}
${input}
\`\`\`
${contextInfo}

Gere uma implementação completa com:
- Todos os métodos implementados com lógica funcional
- Validação de entrada apropriada
- Tratamento de erros
- Comentários explicativos
- Boas práticas da linguagem

Retorne APENAS o código:`,

        class: `
Gere uma classe completa em ${language} baseada na descrição:

Descrição: ${input}
${contextInfo}
${variableInfo}

A classe deve incluir:
- Propriedades relevantes com tipos apropriados
- Construtor com validação de parâmetros
- Métodos públicos e privados necessários
- Documentação JSDoc/comentários
- Tratamento de erros e validação
- Padrões de design apropriados

Retorne APENAS o código da classe:`,

        tests: `
Gere testes unitários completos para o seguinte código ${language}:

Código para testar:
\`\`\`${language}
${input}
\`\`\`
${contextInfo}

Gere testes que cubram:
- Casos de sucesso (happy path)
- Casos de erro e exceções
- Edge cases e limites
- Validação de entrada
- Mocking de dependências quando necessário
- Asserções detalhadas

Use framework de teste apropriado para ${language}.
Retorne APENAS o código dos testes:`,

        api: `
Gere uma API ${language} completa baseada na descrição:

Descrição: ${input}
${contextInfo}
${variableInfo}

Gere:
- Endpoints CRUD completos (GET, POST, PUT, DELETE)
- Validação de entrada robusta
- Tratamento de erros padronizado
- Middleware de autenticação/autorização
- Documentação de API (OpenAPI/Swagger)
- Serialização/deserialização de dados
- Logging apropriado

Retorne APENAS o código:`,

        template: `
Gere código ${language} usando o template especificado:

Template: ${input}
${contextInfo}
${variableInfo}

Siga as melhores práticas para o padrão especificado.
Inclua toda a estrutura necessária.
Retorne APENAS o código:`
    };

    return prompts[type] || prompts.template;
}


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
