import * as vscode from 'vscode';
import { 
    ConversationContext, 
    ContextualSuggestion, 
    WorkspaceAnalysis,
    ConversationEntry,
    CodeContext,
    GitInfo,
    ContextAwareConfig
} from '../types';
import { Logger } from '../utils/Logger';
import { WorkspaceAnalysisService } from './WorkspaceAnalysisService';
import { ConversationHistoryService } from './ConversationHistoryService';
import { CodeContextService } from './CodeContextService';
import { GitIntegrationService } from './GitIntegrationService';

/**
 * Serviço principal para gerenciar contexto consciente
 */
export class ContextAwareService {
    private static instance: ContextAwareService;
    private context: vscode.ExtensionContext;
    private workspaceAnalysisService: WorkspaceAnalysisService;
    private conversationHistoryService: ConversationHistoryService;
    private codeContextService: CodeContextService;
    private gitIntegrationService: GitIntegrationService;
    private isInitialized = false;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance(context);
        this.conversationHistoryService = ConversationHistoryService.getInstance(context);
        this.codeContextService = CodeContextService.getInstance();
        this.gitIntegrationService = GitIntegrationService.getInstance();
    }

    static getInstance(context?: vscode.ExtensionContext): ContextAwareService {
        if (!ContextAwareService.instance && context) {
            ContextAwareService.instance = new ContextAwareService(context);
        }
        return ContextAwareService.instance;
    }

    /**

     * Inicializa o serviço com análise inicial do workspace
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        Logger.info('Initializing Context-Aware Service...');

        try {
            // Show initialization progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "xCopilot: Analisando workspace...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: "Carregando configurações..." });
                
                progress.report({ increment: 40, message: "Analisando estrutura do projeto..." });
                await this.workspaceAnalysisService.analyzeWorkspace();
                
                progress.report({ increment: 80, message: "Configurando contexto..." });
                await this.setupContextWatchers();
                
                progress.report({ increment: 100, message: "Pronto!" });
            });

            this.isInitialized = true;
            
            // Set context for UI
            vscode.commands.executeCommand('setContext', 'xcopilot.contextAware', true);
            
            Logger.info('Context-Aware Service initialized successfully');

        } catch (error) {
            Logger.error('Error initializing Context-Aware Service:', error);
            vscode.window.showErrorMessage('Erro ao inicializar análise de contexto do xCopilot');
        }
    }

    /**
     * Obtém contexto completo para uma conversa
     */
    async getConversationContext(userMessage: string): Promise<ConversationContext> {
        const context: ConversationContext = {
            recentConversations: [],
            relevantCode: [],
            suggestions: []
        };

        try {
            // Get workspace analysis
            const workspaceAnalysis = this.workspaceAnalysisService.getCurrentAnalysis();
            if (workspaceAnalysis) {
                context.workspaceAnalysis = workspaceAnalysis;
            }

            // Get current file context
            const currentFile = this.codeContextService.getCurrentContext(true);
            if (currentFile) {
                context.currentFile = currentFile;
            }

            // Get Git information
            const gitInfo = await this.gitIntegrationService.getGitInfo();
            if (gitInfo) {
                context.gitInfo = gitInfo;
            }

            // Get relevant conversations
            context.recentConversations = this.getRelevantConversations(userMessage, currentFile);

            // Get relevant code snippets
            context.relevantCode = await this.getRelevantCode(userMessage, currentFile);

            // Generate contextual suggestions
            context.suggestions = await this.generateSuggestions(context);

            // Get semantic context (simplified - would use vector search in full implementation)
            context.memoryContext = this.getMemoryContext(userMessage, context);

            Logger.debug('Generated conversation context', { 
                hasWorkspace: !!context.workspaceAnalysis,
                hasCurrentFile: !!context.currentFile,
                hasGit: !!context.gitInfo,
                conversationCount: context.recentConversations.length,
                suggestionCount: context.suggestions.length
            });

            return context;

        } catch (error) {
            Logger.error('Error getting conversation context:', error);
            return context;
        }
    }

    /**
     * Obtém conversas relevantes baseadas no contexto atual
     */
    private getRelevantConversations(userMessage: string, currentFile?: CodeContext): ConversationEntry[] {
        const allEntries = this.conversationHistoryService.getRecentEntries(20);
        const relevant: ConversationEntry[] = [];

        // Get conversations from the same file
        if (currentFile?.fileName) {
            const sameFileConversations = allEntries.filter(entry => 
                entry.fileName === currentFile.fileName
            ).slice(0, 3);
            relevant.push(...sameFileConversations);
        }

        // Get conversations with similar topics (simple keyword matching)
        const keywords = this.extractKeywords(userMessage);
        const topicRelevant = allEntries.filter(entry => {
            const entryKeywords = this.extractKeywords(entry.userMessage + ' ' + entry.aiResponse);
            return keywords.some(keyword => entryKeywords.includes(keyword));
        }).slice(0, 3);

        // Merge and deduplicate
        for (const entry of topicRelevant) {
            if (!relevant.some(r => r.id === entry.id)) {
                relevant.push(entry);
            }
        }

        // Limit to most recent 5
        return relevant.slice(0, 5);
    }

    /**
     * Extrai palavras-chave simples de um texto
     */
    private extractKeywords(text: string): string[] {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10); // Limit keywords
    }

    /**
     * Obtém código relevante para o contexto
     */
    private async getRelevantCode(userMessage: string, currentFile?: CodeContext): Promise<string[]> {
        const relevantCode: string[] = [];

        try {
            // Include current file context if available
            if (currentFile?.selectedText) {
                relevantCode.push(`Current selection in ${currentFile.fileName}:\n${currentFile.selectedText}`);
            } else if (currentFile?.fullFileContent && currentFile.fullFileContent.length < 2000) {
                relevantCode.push(`Current file ${currentFile.fileName}:\n${currentFile.fullFileContent}`);
            }

            // Get related files based on imports/references (simplified)
            if (currentFile?.fileName) {
                const relatedFiles = await this.findRelatedFiles(currentFile.fileName);
                for (const file of relatedFiles.slice(0, 2)) {
                    try {
                        const uri = vscode.Uri.file(file);
                        const document = await vscode.workspace.openTextDocument(uri);
                        if (document.getText().length < 1000) {
                            relevantCode.push(`Related file ${file}:\n${document.getText()}`);
                        }
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            }

        } catch (error) {
            Logger.warn('Error getting relevant code:', error);
        }

        return relevantCode;
    }

    /**
     * Encontra arquivos relacionados (simplificado)
     */
    private async findRelatedFiles(fileName: string): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        const related: string[] = [];
        const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
        const baseNameWithoutPath = baseName.split('/').pop() || '';

        try {
            const pattern = `**/${baseNameWithoutPath}.*`;
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 10);
            
            for (const file of files) {
                const filePath = file.fsPath;
                if (filePath !== fileName) {
                    related.push(filePath);
                }
            }
        } catch (error) {
            Logger.warn('Error finding related files:', error);
        }

        return related;
    }

    /**
     * Gera sugestões contextuais
     */
    private async generateSuggestions(context: ConversationContext): Promise<ContextualSuggestion[]> {
        const suggestions: ContextualSuggestion[] = [];

        try {
            // Suggestions based on current file
            if (context.currentFile) {
                suggestions.push(...this.generateFileBasedSuggestions(context.currentFile));
            }

            // Suggestions based on workspace analysis
            if (context.workspaceAnalysis) {
                suggestions.push(...this.generateWorkspaceBasedSuggestions(context.workspaceAnalysis));
            }

            // Suggestions based on Git status
            if (context.gitInfo) {
                suggestions.push(...this.generateGitBasedSuggestions(context.gitInfo));
            }

            // Sort by relevance
            suggestions.sort((a, b) => b.relevance - a.relevance);

        } catch (error) {
            Logger.warn('Error generating suggestions:', error);
        }

        return suggestions.slice(0, 5); // Limit to top 5
    }

    /**
     * Gera sugestões baseadas no arquivo atual
     */
    private generateFileBasedSuggestions(fileContext: CodeContext): ContextualSuggestion[] {
        const suggestions: ContextualSuggestion[] = [];

        if (fileContext.selectedText) {
            suggestions.push({
                id: 'explain-selection',
                type: 'documentation',
                title: 'Explicar código selecionado',
                description: 'Obter explicação detalhada do código selecionado',
                relevance: 0.9,
                context: 'Código selecionado disponível',
                action: 'xcopilot.explainSelected'
            });

            suggestions.push({
                id: 'refactor-selection',
                type: 'refactor',
                title: 'Refatorar código selecionado',
                description: 'Sugerir melhorias para o código selecionado',
                relevance: 0.8,
                context: 'Código selecionado disponível',
                action: 'xcopilot.refactorCode'
            });
        }

        if (fileContext.fileType === 'typescript' || fileContext.fileType === 'javascript') {
            suggestions.push({
                id: 'generate-tests',
                type: 'test',
                title: 'Gerar testes unitários',
                description: 'Criar testes para este arquivo',
                relevance: 0.7,
                context: 'Arquivo JS/TS detectado',
                action: 'xcopilot.generateTests'
            });
        }

        return suggestions;
    }

    /**
     * Gera sugestões baseadas na análise do workspace
     */
    private generateWorkspaceBasedSuggestions(analysis: WorkspaceAnalysis): ContextualSuggestion[] {
        const suggestions: ContextualSuggestion[] = [];

        // Suggest architecture documentation if project is large
        if (analysis.projectStructure.totalFiles > 50) {
            suggestions.push({
                id: 'document-architecture',
                type: 'documentation',
                title: 'Documentar arquitetura',
                description: 'Gerar documentação da arquitetura do projeto',
                relevance: 0.6,
                context: `Projeto com ${analysis.projectStructure.totalFiles} arquivos`,
                action: 'xcopilot.generateArchitectureDoc'
            });
        }

        // Suggest optimization if many dependencies
        if (analysis.dependencies.dependencies.length > 20) {
            suggestions.push({
                id: 'optimize-deps',
                type: 'optimize',
                title: 'Otimizar dependências',
                description: 'Analisar e otimizar dependências do projeto',
                relevance: 0.5,
                context: `${analysis.dependencies.dependencies.length} dependências encontradas`
            });
        }

        return suggestions;
    }

    /**
     * Gera sugestões baseadas no status do Git
     */
    private generateGitBasedSuggestions(gitInfo: GitInfo): ContextualSuggestion[] {
        const suggestions: ContextualSuggestion[] = [];

        if (gitInfo.hasUncommittedChanges) {
            suggestions.push({
                id: 'generate-commit',
                type: 'documentation',
                title: 'Gerar mensagem de commit',
                description: 'Criar mensagem de commit baseada nas mudanças',
                relevance: 0.8,
                context: 'Mudanças não commitadas detectadas',
                action: 'xcopilot.generateCommit'
            });

            suggestions.push({
                id: 'review-changes',
                type: 'documentation',
                title: 'Revisar mudanças',
                description: 'Analisar mudanças antes do commit',
                relevance: 0.7,
                context: 'Mudanças não commitadas detectadas',
                action: 'xcopilot.analyzeDiff'
            });
        }

        return suggestions;
    }

    /**
     * Obtém contexto de memória (RAG simplificado)
     */
    private getMemoryContext(userMessage: string, context: ConversationContext): string {
        const memoryParts: string[] = [];

        // Include recent relevant conversations
        if (context.recentConversations.length > 0) {
            memoryParts.push('Conversas recentes relevantes:');
            for (const conv of context.recentConversations.slice(0, 2)) {
                memoryParts.push(`- ${conv.userMessage} -> ${conv.aiResponse.substring(0, 100)}...`);
            }
        }

        // Include current project context
        if (context.workspaceAnalysis) {
            const analysis = context.workspaceAnalysis;
            memoryParts.push(`\nContexto do projeto:`);
            memoryParts.push(`- Linguagem: ${analysis.architecture.language}`);
            memoryParts.push(`- Frameworks: ${analysis.architecture.frameworks.join(', ')}`);
            memoryParts.push(`- ${analysis.projectStructure.totalFiles} arquivos, ${analysis.projectStructure.totalLines} linhas`);
        }

        // Include current file context
        if (context.currentFile) {
            memoryParts.push(`\nArquivo atual: ${context.currentFile.fileName} (${context.currentFile.fileType})`);
        }

        return memoryParts.join('\n');
    }

    /**
     * Formata contexto para envio ao backend
     */
    formatContextForPrompt(userMessage: string, context: ConversationContext): string {
        let formattedPrompt = userMessage;

        // Add memory context
        if (context.memoryContext) {
            formattedPrompt += `\n\n**Contexto do projeto:**\n${context.memoryContext}`;
        }

        // Add current file context
        if (context.currentFile?.selectedText) {
            formattedPrompt += `\n\n**Código selecionado:**\n\`\`\`${context.currentFile.fileType}\n${context.currentFile.selectedText}\n\`\`\``;
        }

        // Add relevant code
        if (context.relevantCode.length > 0) {
            formattedPrompt += `\n\n**Código relacionado:**\n${context.relevantCode.join('\n\n')}`;
        }

        return formattedPrompt;
    }

    /**
     * Configura watchers para mudanças de contexto
     */
    private async setupContextWatchers(): Promise<void> {
        // Watch for file changes
        vscode.workspace.onDidChangeTextDocument((event) => {
            // Could trigger re-analysis for specific files
        });

        // Watch for file creation/deletion
        vscode.workspace.onDidCreateFiles((event) => {
            // Could trigger workspace re-analysis
        });

        vscode.workspace.onDidDeleteFiles((event) => {
            // Could trigger workspace re-analysis
        });

        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            // Could update current context
        });
    }

    /**
     * Obtém configuração do context-aware
     */
    private getConfig(): ContextAwareConfig {
        const config = vscode.workspace.getConfiguration('xcopilot.contextAware');
        return {
            enableWorkspaceAnalysis: config.get('enableWorkspaceAnalysis', true),
            enableSemanticSearch: config.get('enableSemanticSearch', true),
            maxContextSize: config.get('maxContextSize', 4000),
            analysisDepth: config.get('analysisDepth', 'medium'),
            memorySessions: config.get('memorySessions', 5),
            autoSuggestions: config.get('autoSuggestions', true)
        };
    }

    /**
     * Força re-análise do workspace
     */
    async refreshWorkspaceAnalysis(): Promise<void> {
        Logger.info('Refreshing workspace analysis...');
        await this.workspaceAnalysisService.analyzeWorkspace(true);
        vscode.window.showInformationMessage('Análise do workspace atualizada!');
    }

    /**
     * Obtém estatísticas do contexto
     */
    getContextStats(): { 
        isInitialized: boolean;
        hasWorkspaceAnalysis: boolean;
        conversationCount: number;
        lastAnalysis?: Date;
    } {
        const analysis = this.workspaceAnalysisService.getCurrentAnalysis();
        const conversationCount = this.conversationHistoryService.getRecentEntries(100).length;

        return {
            isInitialized: this.isInitialized,
            hasWorkspaceAnalysis: !!analysis,
            conversationCount,
            lastAnalysis: analysis?.lastAnalyzed
        };
    }
}