// Backend inicial para xCopilot
require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const contextChatRoutes = require('./routes/context-chat');

// Centralização de configurações
const config = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    port: PORT,
    env: process.env.NODE_ENV || 'development'
};

app.use(express.json());

// Use context-aware chat routes
app.use('/api', contextChatRoutes);

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
const { gerarResposta, gerarCompletion, gerarMultilineCode, OpenAIError } = require('./openai');
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

// Multi-line code generation endpoint  
app.post('/api/generate-function', async (req, res) => {
    const { prompt, type, language, context } = req.body;
    
    if (!prompt || !type) {
        return res.status(400).json({ error: 'Prompt e type são obrigatórios.' });
    }

    try {
        const startTime = Date.now();
        
        // Use specialized generation function for multi-line code
        const code = await gerarMultilineCode({
            prompt,
            type,
            language: language || 'javascript',
            context: context || '',
            maxTokens: 300, // More tokens for multi-line generation
            temperature: 0.4 // Slightly higher creativity for complex implementations
        });
        
        const duration = Date.now() - startTime;
        
        res.json({ 
            code,
            duration,
            type
        });
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

// Enhanced context-aware endpoint for better prompts
app.post('/api/context-aware', async (req, res) => {
    const { 
        prompt, 
        workspaceContext, 
        conversationHistory, 
        gitInfo, 
        codeContext 
    } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    try {
        const startTime = Date.now();
        
        // Build enhanced context for AI
        let enhancedPrompt = prompt;
        const contextParts = [];

        // Add workspace context
        if (workspaceContext) {
            contextParts.push(`**Contexto do Projeto:**
- Linguagem: ${workspaceContext.language}
- Frameworks: ${workspaceContext.frameworks.join(', ') || 'Nenhum'}
- Arquivos: ${workspaceContext.totalFiles}
- Padrão: ${workspaceContext.architecturePattern || 'Não identificado'}`);
        }

        // Add code context
        if (codeContext && codeContext.currentFile) {
            contextParts.push(`**Arquivo Atual:** ${codeContext.currentFile.fileName} (${codeContext.currentFile.fileType})`);
            
            if (codeContext.currentFile.selectedText) {
                contextParts.push(`**Código Selecionado:**
\`\`\`${codeContext.currentFile.fileType}
${codeContext.currentFile.selectedText}
\`\`\``);
            }
        }

        // Add relevant code snippets
        if (codeContext && codeContext.relevantCode && codeContext.relevantCode.length > 0) {
            contextParts.push(`**Código Relacionado:**
${codeContext.relevantCode.slice(0, 2).join('\n\n')}`);
        }

        // Add Git context
        if (gitInfo) {
            let gitContext = `**Git:** ${gitInfo.currentBranch || gitInfo.branch}`;
            if (gitInfo.hasUncommittedChanges) {
                gitContext += ` (mudanças não commitadas)`;
            }
            if (gitInfo.lastCommitMessage) {
                gitContext += `\nÚltimo commit: ${gitInfo.lastCommitMessage}`;
            }
            contextParts.push(gitContext);
        }

        // Add conversation memory
        if (conversationHistory && conversationHistory.length > 0) {
            const recentConversations = conversationHistory.slice(0, 2);
            const memoryContext = recentConversations.map(conv => 
                `Q: ${conv.userMessage.substring(0, 100)}... A: ${conv.aiResponse.substring(0, 100)}...`
            ).join('\n');
            contextParts.push(`**Contexto de Conversa Recente:**
${memoryContext}`);
        }

        // Combine all context
        if (contextParts.length > 0) {
            enhancedPrompt = `${prompt}

${contextParts.join('\n\n')}

Responda considerando todo o contexto fornecido e seja específico para este projeto.`;
        }

        // Generate response with enhanced context
        const response = await gerarResposta(enhancedPrompt);
        
        const duration = Date.now() - startTime;
        
        res.json({ 
            response,
            prompt: enhancedPrompt,
            duration,
            contextUsed: {
                hasWorkspace: !!workspaceContext,
                hasGit: !!gitInfo,
                hasCode: !!codeContext,
                hasMemory: !!(conversationHistory && conversationHistory.length > 0),
                contextSize: enhancedPrompt.length
            }
        });
        
    } catch (err) {
        if (err instanceof OpenAIError) {
            return res.status(err.status || 500).json({ error: err.message, code: err.code });
        }
        res.status(500).json({ error: 'Erro inesperado', detail: err.message });
    }
});

// Endpoint for workspace analysis
app.post('/api/analyze-workspace', async (req, res) => {
    const { projectStructure, dependencies, codePatterns } = req.body;
    
    try {
        // Generate insights about the workspace
        const analysisPrompt = `Analise esta estrutura de projeto e forneça insights:

**Estrutura:**
- ${projectStructure.totalFiles} arquivos
- ${projectStructure.totalLines} linhas de código
- Diretórios principais: ${projectStructure.directories.map(d => d.path).join(', ')}

**Dependências:**
- Linguagens: ${dependencies.languages.join(', ')}
- Frameworks: ${dependencies.frameworks.join(', ')}
- Pacotes principais: ${dependencies.dependencies.slice(0, 10).join(', ')}

**Padrões de Código:**
${codePatterns.slice(0, 5).map(p => `- ${p.type}: ${p.pattern} (${p.frequency}x)`).join('\n')}

Forneça insights sobre:
1. Arquitetura e organização
2. Qualidade do código
3. Sugestões de melhoria
4. Tecnologias bem utilizadas
5. Possíveis problemas`;

        const insights = await gerarResposta(analysisPrompt);
        
        res.json({ insights });
        
    } catch (err) {
        if (err instanceof OpenAIError) {
            return res.status(err.status || 500).json({ error: err.message, code: err.code });
        }
        res.status(500).json({ error: 'Erro inesperado', detail: err.message });
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
