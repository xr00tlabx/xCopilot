import * as vscode from 'vscode';
import { BackendService, CodeContextService, ConversationHistoryService, GitIntegrationService } from '../services';
import { ChatMessage } from '../types';
import { Logger } from '../utils';
import { getChatHtml } from './WebviewHtml';

/**
 * Provedor da webview para o chat do xCopilot
 */
export class ChatWebviewProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private historyService: ConversationHistoryService;
    private gitService: GitIntegrationService;

    constructor(context: vscode.ExtensionContext) {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.historyService = ConversationHistoryService.getInstance(context);
        this.gitService = GitIntegrationService.getInstance();
    }

    /**
     * Resolve a webview view
     */
    resolveWebviewView(webviewView: vscode.WebviewView): void {
        Logger.info('Webview view resolved successfully');
        this.view = webviewView;

        // Configurar opções da webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };

        // Definir o HTML
        Logger.debug('Setting HTML content...');
        webviewView.webview.html = getChatHtml();

        // Configurar listener para mensagens
        webviewView.webview.onDidReceiveMessage(async (message: ChatMessage) => {
            await this.handleMessage(message);
        });

        Logger.info('Webview fully configured');
    }

    /**
     * Lida com mensagens recebidas da webview
     */
    private async handleMessage(message: ChatMessage): Promise<void> {
        Logger.debug('Received message:', message);

        if (message.type === 'ask' && message.prompt) {
            Logger.info(`Processing ask request: ${message.prompt}`);

            // Enviar resposta inicial
            this.sendMessage({ type: 'answer', text: 'Pensando...' });

            try {
                // Capturar contexto automaticamente se disponível
                const context = this.contextService.getContextWithFallback(10);
                let finalPrompt = message.prompt;

                if (context && this.contextService.hasUsefulContext()) {
                    finalPrompt = this.contextService.formatContextForPrompt(context, message.prompt);
                    Logger.debug(`Added context to prompt for ${context.fileName}`);
                }

                const answer = await this.backendService.askQuestion(finalPrompt);
                this.sendMessage({ type: 'answer', text: answer });

                // Salvar no histórico
                this.historyService.addEntry(message.prompt, answer, context || undefined);

            } catch (error) {
                Logger.error('Error calling backend:', error);
                const errorMessage = `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
                this.sendMessage({
                    type: 'answer',
                    text: errorMessage
                });

                // Salvar erro no histórico também
                this.historyService.addEntry(message.prompt, errorMessage);
            }
        }
    }

    /**
     * Envia uma mensagem para a webview
     */
    private sendMessage(message: ChatMessage): void {
        if (this.view) {
            this.view.webview.postMessage(message);
        }
    }

    /**
     * Envia uma pergunta programaticamente para o chat
     */
    async askQuestion(prompt: string): Promise<void> {
        if (!this.view) {
            throw new Error('Webview não está inicializada');
        }

        Logger.info(`Sending programmatic question: ${prompt}`);
        this.sendMessage({ type: 'answer', text: 'Pensando...' });

        try {
            const answer = await this.backendService.askQuestion(prompt);
            this.sendMessage({ type: 'answer', text: answer });
        } catch (error) {
            Logger.error('Error in programmatic question:', error);
            this.sendMessage({
                type: 'answer',
                text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
            });
        }
    }

    /**
     * Envia uma pergunta com contexto específico
     */
    async askQuestionWithContext(prompt: string, includeFullFile: boolean = false): Promise<void> {
        if (!this.view) {
            throw new Error('Webview não está inicializada');
        }

        Logger.info(`Sending question with context: ${prompt}`);
        this.sendMessage({ type: 'answer', text: 'Analisando contexto...' });

        try {
            const context = includeFullFile ? 
                this.contextService.getCurrentContext(true) : 
                this.contextService.getContextWithFallback(10);

            let finalPrompt = prompt;
            if (context) {
                finalPrompt = this.contextService.formatContextForPrompt(context, prompt);
                Logger.debug(`Context added for ${context.fileName}`);
            } else {
                Logger.warn('No context available');
                this.sendMessage({ type: 'answer', text: 'Nenhum arquivo aberto para análise de contexto.' });
                return;
            }

            const answer = await this.backendService.askQuestion(finalPrompt);
            this.sendMessage({ type: 'answer', text: answer });
        } catch (error) {
            Logger.error('Error in context question:', error);
            this.sendMessage({
                type: 'answer',
                text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
            });
        }
    }

    /**
     * Obtém informações de contexto atual
     */
    getContextInfo(): string {
        const stats = this.contextService.getContextStats();
        if (!stats) {
            return 'Nenhum arquivo aberto';
        }

        return `📁 ${stats.fileName} (${stats.fileType}) - ${stats.linesInFile} linhas${stats.hasSelection ? ' - Texto selecionado' : ''}`;
    }

    /**
     * Verifica se a webview está ativa
     */
    isActive(): boolean {
        return this.view !== undefined;
    }

    /**
     * Obtém a instância da view (se disponível)
     */
    getView(): vscode.WebviewView | undefined {
        return this.view;
    }

    /**
     * Pesquisar no histórico de conversas
     */
    async searchHistory(searchTerm: string): Promise<void> {
        try {
            const results = await this.historyService.search(searchTerm);
            if (results.length === 0) {
                this.sendMessage({
                    type: 'answer',
                    text: `Nenhuma conversa encontrada para "${searchTerm}"`
                });
                return;
            }

            let response = `**Encontradas ${results.length} conversas para "${searchTerm}":**\n\n`;
            results.forEach((entry, index) => {
                const date = new Date(entry.timestamp).toLocaleString('pt-BR');
                response += `**${index + 1}. ${date}**\n`;
                response += `**Pergunta:** ${entry.userMessage}\n`;
                response += `**Resposta:** ${entry.aiResponse.substring(0, 100)}...\n\n`;
            });

            this.sendMessage({
                type: 'answer',
                text: response
            });
        } catch (error) {
            Logger.error('Error searching history:', error);
            this.sendMessage({
                type: 'answer',
                text: 'Erro ao pesquisar no histórico'
            });
        }
    }

    /**
     * Exportar histórico para arquivo
     */
    async exportHistory(filePath: string): Promise<void> {
        try {
            const markdownContent = this.historyService.exportToMarkdown();
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(markdownContent, 'utf8'));
            this.sendMessage({
                type: 'answer',
                text: `Histórico exportado com sucesso para: ${filePath}`
            });
        } catch (error) {
            Logger.error('Error exporting history:', error);
            throw error;
        }
    }

    /**
     * Limpar histórico de conversas
     */
    async clearHistory(): Promise<void> {
        try {
            this.historyService.clearHistory();
            this.sendMessage({
                type: 'answer',
                text: 'Histórico limpo com sucesso'
            });
        } catch (error) {
            Logger.error('Error clearing history:', error);
            throw error;
        }
    }

    /**
     * Gerar mensagem de commit baseada nas mudanças
     */
    async generateCommitMessage(): Promise<void> {
        try {
            this.sendMessage({ type: 'answer', text: 'Analisando mudanças do Git...' });
            
            const gitInfo = await this.gitService.getGitInfo();
            if (!gitInfo || gitInfo.changedFiles.length === 0) {
                this.sendMessage({
                    type: 'answer',
                    text: 'Nenhuma mudança encontrada no repositório Git'
                });
                return;
            }

            const commitMessage = await this.gitService.generateCommitMessage(gitInfo.changedFiles, gitInfo.diff);
            this.sendMessage({
                type: 'answer',
                text: `**Mensagem de commit sugerida:**\n\n\`\`\`\n${commitMessage}\n\`\`\``
            });
        } catch (error) {
            Logger.error('Error generating commit message:', error);
            this.sendMessage({
                type: 'answer',
                text: 'Erro ao gerar mensagem de commit. Verifique se você está em um repositório Git.'
            });
        }
    }

    /**
     * Analisar diferenças do arquivo atual
     */
    async analyzeDiff(): Promise<void> {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                this.sendMessage({
                    type: 'answer',
                    text: 'Nenhum arquivo ativo para analisar'
                });
                return;
            }

            this.sendMessage({ type: 'answer', text: 'Analisando diferenças do arquivo...' });
            
            const diff = await this.gitService.getCurrentFileDiff();
            if (!diff) {
                this.sendMessage({
                    type: 'answer',
                    text: 'Nenhuma mudança encontrada no arquivo atual'
                });
                return;
            }

            const prompt = `Analise as seguintes mudanças no arquivo e explique o que foi alterado:\n\n\`\`\`diff\n${diff}\n\`\`\``;
            const analysis = await this.backendService.askQuestion(prompt);
            
            this.sendMessage({
                type: 'answer',
                text: analysis
            });

            // Salvar no histórico
            this.historyService.addEntry(
                'Análise de diferenças do arquivo atual',
                analysis,
                this.contextService.getCurrentContext() || undefined
            );
        } catch (error) {
            Logger.error('Error analyzing diff:', error);
            this.sendMessage({
                type: 'answer',
                text: 'Erro ao analisar diferenças. Verifique se você está em um repositório Git.'
            });
        }
    }
}
