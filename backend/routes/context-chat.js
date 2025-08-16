// Context-aware chat route with RAG implementation
const express = require('express');
const { gerarResposta } = require('../openai');
const { indexSnippet, searchSnippets } = require('../elasticsearch');

const router = express.Router();

// Enhanced prompt template for context-aware responses
function buildContextAwarePrompt(userMessage, context) {
    const {
        currentContext,
        retrievalContext,
        conversationContext,
        workspaceContext
    } = context;

    let systemPrompt = `You are xCopilot, an advanced AI coding assistant with deep knowledge of the current project.

Project Context:
${workspaceContext}

Current File Context:`;

    if (currentContext) {
        systemPrompt += `
File: ${currentContext.fileName} (${currentContext.fileType})
${currentContext.selectedText ? `Selected Code:\n${currentContext.selectedText}` : ''}
${currentContext.fullFileContent ? `\nFile Content (excerpt):\n${currentContext.fullFileContent.substring(0, FILE_EXCERPT_CHAR_LIMIT)}...` : ''}`;
    } else {
        systemPrompt += ' No active file';
    }

    if (retrievalContext && retrievalContext.relevantFiles.length > 0) {
        systemPrompt += `\n\nRelevant Code Context (from project analysis):`;
        retrievalContext.relevantFiles.forEach((file, index) => {
            if (index < 3) { // Limit to top 3 results
                systemPrompt += `\n\nFile: ${file.split('/').pop()}
${retrievalContext.relevantContent[index].substring(0, RELEVANT_CONTENT_CHAR_LIMIT)}...
(Relevance Score: ${(retrievalContext.embeddingScores[index] * 100).toFixed(1)}%)`;
            }
        });
    }

    if (conversationContext) {
        systemPrompt += `\n\nRecent Conversation History:
${conversationContext}`;
    }

    systemPrompt += `\n\nInstructions:
- Provide accurate, contextual responses based on the project structure and patterns
- Reference specific files, functions, or patterns when relevant
- Suggest improvements that align with the project's conventions
- If implementing new features, follow the existing architectural patterns
- Be concise but thorough in explanations
- Always consider the current file context when giving advice

User Question: ${userMessage}`;

    return systemPrompt;
}

// Context-aware chat endpoint
router.post('/context-chat', async (req, res) => {
    try {
        const { userMessage, context } = req.body;

        if (!userMessage) {
            return res.status(400).json({ error: 'userMessage é obrigatório' });
        }

        // Build enhanced prompt with context
        const enhancedPrompt = buildContextAwarePrompt(userMessage, context);

        // Get AI response
        const aiResponse = await gerarResposta(enhancedPrompt);

        // Index this conversation for future retrieval
        try {
            const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await indexSnippet({
                id: conversationId,
                content: `Q: ${userMessage}\nA: ${aiResponse}`,
                language: 'conversation'
            });
        } catch (indexError) {
            console.warn('Failed to index conversation:', indexError);
        }

        // Return enhanced response with metadata
        res.json({
            response: aiResponse,
            contextUsed: {
                hasCurrentContext: !!context.currentContext,
                relevantFilesCount: context.retrievalContext?.relevantFiles?.length || 0,
                hasConversationHistory: !!context.conversationContext,
                hasWorkspaceContext: !!context.workspaceContext
            },
            retrievalContext: context.retrievalContext
        });

    } catch (error) {
        console.error('Error in context-aware chat:', error);
        res.status(500).json({ 
            error: 'Erro no chat com contexto', 
            detail: error.message 
        });
    }
});

// Endpoint to store embeddings
router.post('/embeddings', async (req, res) => {
    try {
        const { id, filePath, content, embeddings, metadata } = req.body;

        if (!id || !content || !embeddings) {
            return res.status(400).json({ error: 'id, content e embeddings são obrigatórios' });
        }

        // Store in Elasticsearch with embeddings
        await indexSnippet({
            id,
            content,
            language: metadata?.fileType || 'unknown',
            filePath,
            embeddings,
            metadata
        });

        res.json({ success: true, message: 'Embedding armazenado com sucesso' });

    } catch (error) {
        console.error('Error storing embedding:', error);
        res.status(500).json({ 
            error: 'Erro ao armazenar embedding', 
            detail: error.message 
        });
    }
});

// Endpoint to search for relevant context
router.post('/search-context', async (req, res) => {
    try {
        const { query, maxResults = 5 } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'query é obrigatório' });
        }

        // Search using Elasticsearch
        const results = await searchSnippets(query);

        // Filter and enhance results
        const relevantResults = results
            .slice(0, maxResults)
            .map(result => ({
                id: result.id,
                content: result.content,
                score: result.score,
                filePath: result.filePath,
                metadata: result.metadata
            }));

        res.json({
            results: relevantResults,
            totalFound: results.length,
            query
        });

    } catch (error) {
        console.error('Error searching context:', error);
        res.status(500).json({ 
            error: 'Erro na busca de contexto', 
            detail: error.message 
        });
    }
});

// Endpoint to get workspace insights
router.get('/workspace-insights', async (req, res) => {
    try {
        // Search for common patterns in the codebase
        const patterns = await searchSnippets('function class interface');
        
        // Analyze the patterns
        const insights = {
            totalCodeSnippets: patterns.length,
            commonPatterns: patterns.slice(0, 10).map(p => ({
                type: p.language,
                score: p.score,
                snippet: p.content.substring(0, 100) + '...'
            })),
            timestamp: new Date().toISOString()
        };

        res.json(insights);

    } catch (error) {
        console.error('Error getting workspace insights:', error);
        res.status(500).json({ 
            error: 'Erro ao obter insights do workspace', 
            detail: error.message 
        });
    }
});

module.exports = router;