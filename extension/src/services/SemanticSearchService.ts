import * as vscode from 'vscode';
import { ConversationEntry, SemanticSearchResult } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para busca semântica e RAG (versão simplificada)
 * Em uma implementação completa, usaria vector embeddings reais
 */
export class SemanticSearchService {
    private static instance: SemanticSearchService;
    private context: vscode.ExtensionContext;
    private vectorCache = new Map<string, number[]>();

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    static getInstance(context?: vscode.ExtensionContext): SemanticSearchService {
        if (!SemanticSearchService.instance && context) {
            SemanticSearchService.instance = new SemanticSearchService(context);
        }
        return SemanticSearchService.instance;
    }

    /**
     * Busca semântica em conversas anteriores
     */
    async searchConversations(query: string, conversations: ConversationEntry[], limit: number = 5): Promise<SemanticSearchResult[]> {
        const results: SemanticSearchResult[] = [];

        try {
            const queryVector = this.generateSimpleVector(query);

            for (const conversation of conversations) {
                const text = `${conversation.userMessage} ${conversation.aiResponse}`;
                const textVector = this.generateSimpleVector(text);
                const similarity = this.calculateCosineSimilarity(queryVector, textVector);

                if (similarity > 0.3) { // Threshold for relevance
                    results.push({
                        content: text,
                        similarity,
                        source: 'conversation',
                        metadata: {
                            id: conversation.id,
                            timestamp: conversation.timestamp,
                            fileName: conversation.fileName
                        }
                    });
                }
            }

            // Sort by similarity
            results.sort((a, b) => b.similarity - a.similarity);
            return results.slice(0, limit);

        } catch (error) {
            Logger.error('Error in semantic search:', error);
            return [];
        }
    }

    /**
     * Busca semântica em código
     */
    async searchCode(query: string, codeSnippets: string[], limit: number = 3): Promise<SemanticSearchResult[]> {
        const results: SemanticSearchResult[] = [];

        try {
            const queryVector = this.generateSimpleVector(query);

            for (let i = 0; i < codeSnippets.length; i++) {
                const code = codeSnippets[i];
                const codeVector = this.generateSimpleVector(code);
                const similarity = this.calculateCosineSimilarity(queryVector, codeVector);

                if (similarity > 0.2) {
                    results.push({
                        content: code,
                        similarity,
                        source: 'code',
                        metadata: { index: i }
                    });
                }
            }

            results.sort((a, b) => b.similarity - a.similarity);
            return results.slice(0, limit);

        } catch (error) {
            Logger.error('Error searching code:', error);
            return [];
        }
    }

    /**
     * Extrai context relevante usando RAG simplificado
     */
    async extractRelevantContext(
        query: string,
        conversations: ConversationEntry[],
        codeSnippets: string[] = []
    ): Promise<string> {
        const contextParts: string[] = [];

        try {
            // Search conversations
            const conversationResults = await this.searchConversations(query, conversations, 3);
            if (conversationResults.length > 0) {
                contextParts.push('**Conversas relevantes:**');
                for (const result of conversationResults) {
                    const summary = this.summarizeConversation(result.content);
                    contextParts.push(`- ${summary} (relevância: ${Math.round(result.similarity * 100)}%)`);
                }
            }

            // Search code
            if (codeSnippets.length > 0) {
                const codeResults = await this.searchCode(query, codeSnippets, 2);
                if (codeResults.length > 0) {
                    contextParts.push('\n**Código relevante:**');
                    for (const result of codeResults) {
                        const codePreview = result.content.substring(0, 200) + '...';
                        contextParts.push(`\`\`\`\n${codePreview}\n\`\`\``);
                    }
                }
            }

            return contextParts.join('\n');

        } catch (error) {
            Logger.error('Error extracting relevant context:', error);
            return '';
        }
    }

    /**
     * Gera vetor simples baseado em palavras-chave (TF-IDF simplificado)
     * Em implementação real, usaria embeddings do OpenAI ou similar
     */
    private generateSimpleVector(text: string): number[] {
        const cacheKey = this.hashString(text);

        if (this.vectorCache.has(cacheKey)) {
            return this.vectorCache.get(cacheKey)!;
        }

        // Palavras-chave importantes para desenvolvimento
        const keywords = [
            'function', 'class', 'variable', 'method', 'property',
            'component', 'service', 'api', 'database', 'server',
            'frontend', 'backend', 'authentication', 'security',
            'performance', 'optimization', 'bug', 'error', 'fix',
            'test', 'testing', 'unit', 'integration', 'deploy',
            'git', 'commit', 'branch', 'merge', 'pull', 'request',
            'react', 'vue', 'angular', 'node', 'express', 'typescript',
            'javascript', 'python', 'java', 'docker', 'kubernetes',
            'refactor', 'clean', 'architecture', 'pattern', 'design',
            'async', 'await', 'promise', 'callback', 'event',
            'state', 'props', 'context', 'hook', 'reducer',
            'crud', 'rest', 'graphql', 'websocket', 'http',
            'json', 'xml', 'csv', 'sql', 'mongodb', 'redis'
        ];

        const words = text.toLowerCase().split(/\W+/);
        const vector = new Array(keywords.length).fill(0);

        // Simple TF calculation
        const wordCount = new Map<string, number>();
        for (const word of words) {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
        }

        // Calculate TF for each keyword
        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            const tf = wordCount.get(keyword) || 0;
            vector[i] = tf / words.length; // Normalized term frequency
        }

        this.vectorCache.set(cacheKey, vector);
        return vector;
    }

    /**
     * Calcula similaridade do cosseno entre dois vetores
     */
    private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
        if (vectorA.length !== vectorB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Hash simples para cache
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Sumariza conversa para contexto
     */
    private summarizeConversation(conversationText: string): string {
        const sentences = conversationText.split(/[.!?]+/).filter(s => s.trim().length > 0);

        if (sentences.length <= 2) {
            return conversationText.substring(0, 150);
        }

        // Take first and last sentence as simple summary
        const summary = `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`;
        return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    }

    /**
     * Encontra temas similares em conversas
     */
    async findSimilarTopics(query: string, conversations: ConversationEntry[]): Promise<string[]> {
        const topics = new Set<string>();

        try {
            const results = await this.searchConversations(query, conversations, 10);

            for (const result of results) {
                const keywords = this.extractTopicKeywords(result.content);
                keywords.forEach(keyword => topics.add(keyword));
            }

            return Array.from(topics).slice(0, 10);

        } catch (error) {
            Logger.error('Error finding similar topics:', error);
            return [];
        }
    }

    /**
     * Extrai palavras-chave de tópicos
     */
    private extractTopicKeywords(text: string): string[] {
        const words = text.toLowerCase().split(/\W+/);
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

        return words
            .filter(word => word.length > 3 && !stopWords.has(word))
            .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
            .slice(0, 5);
    }

    /**
     * Limpa cache de vetores
     */
    clearCache(): void {
        this.vectorCache.clear();
        Logger.info('Semantic search cache cleared');
    }

    /**
     * Obtém estatísticas do cache
     */
    getCacheStats(): { size: number; memory: number } {
        const size = this.vectorCache.size;
        const memory = size * 50 * 8; // Approximate memory usage (50 dimensions * 8 bytes per number)
        return { size, memory };
    }
}

