import * as vscode from 'vscode';
import { CodeContext, ConversationEntry, ConversationHistory } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para gerenciar histórico de conversas
 */
export class ConversationHistoryService {
    private static instance: ConversationHistoryService;
    private history: ConversationHistory;
    private readonly storageKey = 'xcopilot.conversationHistory';
    private readonly maxEntries = 100;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.history = this.loadHistory();
    }

    static getInstance(context?: vscode.ExtensionContext): ConversationHistoryService {
        if (!ConversationHistoryService.instance && context) {
            ConversationHistoryService.instance = new ConversationHistoryService(context);
        }
        if (!ConversationHistoryService.instance) {
            throw new Error('ConversationHistoryService must be initialized with context first');
        }
        return ConversationHistoryService.instance;
    }

    /**
     * Adiciona nova entrada ao histórico
     */
    addEntry(userMessage: string, aiResponse: string, context?: CodeContext): void {
        const entry: ConversationEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            userMessage,
            aiResponse,
            context,
            fileName: context?.fileName,
            fileType: context?.fileType
        };

        this.history.entries.unshift(entry); // Adicionar no início
        
        // Limitar tamanho do histórico
        if (this.history.entries.length > this.maxEntries) {
            this.history.entries = this.history.entries.slice(0, this.maxEntries);
        }

        this.history.lastUpdated = new Date();
        this.saveHistory();
        
        Logger.info(`Added conversation entry: ${entry.id}`);
    }

    /**
     * Busca no histórico por texto
     */
    search(query: string, limit: number = 20): ConversationEntry[] {
        const lowerQuery = query.toLowerCase();
        
        return this.history.entries
            .filter(entry => 
                entry.userMessage.toLowerCase().includes(lowerQuery) ||
                entry.aiResponse.toLowerCase().includes(lowerQuery) ||
                entry.fileName?.toLowerCase().includes(lowerQuery)
            )
            .slice(0, limit);
    }

    /**
     * Busca por tipo de arquivo
     */
    searchByFileType(fileType: string, limit: number = 20): ConversationEntry[] {
        return this.history.entries
            .filter(entry => entry.fileType === fileType)
            .slice(0, limit);
    }

    /**
     * Busca por arquivo específico
     */
    searchByFileName(fileName: string, limit: number = 20): ConversationEntry[] {
        return this.history.entries
            .filter(entry => entry.fileName === fileName)
            .slice(0, limit);
    }

    /**
     * Obtém entradas recentes
     */
    getRecent(limit: number = 10): ConversationEntry[] {
        return this.history.entries.slice(0, limit);
    }

    /**
     * Obtém entradas recentes (alias for getRecent)
     */
    getRecentEntries(limit: number = 10): ConversationEntry[] {
        return this.getRecent(limit);
    }

    /**
     * Obtém entrada por ID
     */
    getById(id: string): ConversationEntry | undefined {
        return this.history.entries.find(entry => entry.id === id);
    }

    /**
     * Remove entrada do histórico
     */
    removeEntry(id: string): boolean {
        const index = this.history.entries.findIndex(entry => entry.id === id);
        if (index > -1) {
            this.history.entries.splice(index, 1);
            this.saveHistory();
            Logger.info(`Removed conversation entry: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Limpa todo o histórico
     */
    clearHistory(): void {
        this.history = {
            entries: [],
            totalEntries: 0,
            lastUpdated: new Date()
        };
        this.saveHistory();
        Logger.info('Conversation history cleared');
    }

    /**
     * Exporta histórico para JSON
     */
    exportToJson(): string {
        return JSON.stringify(this.history, null, 2);
    }

    /**
     * Exporta histórico formatado em Markdown
     */
    exportToMarkdown(): string {
        let markdown = '# Histórico de Conversas xCopilot\n\n';
        markdown += `*Exportado em: ${new Date().toLocaleString()}*\n\n`;

        this.history.entries.forEach((entry, index) => {
            markdown += `## Conversa ${index + 1}\n\n`;
            markdown += `**Data:** ${entry.timestamp.toLocaleString()}\n\n`;
            
            if (entry.fileName) {
                markdown += `**Arquivo:** ${entry.fileName}\n\n`;
            }

            markdown += `**Pergunta:**\n${entry.userMessage}\n\n`;
            markdown += `**Resposta:**\n${entry.aiResponse}\n\n`;
            
            if (entry.context?.selectedText) {
                markdown += `**Código analisado:**\n\`\`\`${entry.fileType || ''}\n${entry.context.selectedText}\n\`\`\`\n\n`;
            }

            markdown += '---\n\n';
        });

        return markdown;
    }

    /**
     * Obtém estatísticas do histórico
     */
    getStats(): {
        totalEntries: number;
        byFileType: Record<string, number>;
        byFileName: Record<string, number>;
        oldestEntry?: Date;
        newestEntry?: Date;
    } {
        const byFileType: Record<string, number> = {};
        const byFileName: Record<string, number> = {};

        this.history.entries.forEach(entry => {
            if (entry.fileType) {
                byFileType[entry.fileType] = (byFileType[entry.fileType] || 0) + 1;
            }
            if (entry.fileName) {
                byFileName[entry.fileName] = (byFileName[entry.fileName] || 0) + 1;
            }
        });

        const timestamps = this.history.entries.map(e => e.timestamp);
        
        return {
            totalEntries: this.history.entries.length,
            byFileType,
            byFileName,
            oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
            newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined
        };
    }

    /**
     * Carrega histórico do storage
     */
    private loadHistory(): ConversationHistory {
        try {
            const stored = this.context.globalState.get<any>(this.storageKey);
            if (stored) {
                // Converter strings de data para objetos Date
                stored.entries = stored.entries.map((entry: any) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp)
                }));
                stored.lastUpdated = new Date(stored.lastUpdated);
                
                Logger.info(`Loaded ${stored.entries.length} conversation entries`);
                return stored;
            }
        } catch (error) {
            Logger.error('Error loading conversation history:', error);
        }

        return {
            entries: [],
            totalEntries: 0,
            lastUpdated: new Date()
        };
    }

    /**
     * Salva histórico no storage
     */
    private saveHistory(): void {
        try {
            this.context.globalState.update(this.storageKey, this.history);
        } catch (error) {
            Logger.error('Error saving conversation history:', error);
        }
    }

    /**
     * Gera ID único para entrada
     */
    private generateId(): string {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
