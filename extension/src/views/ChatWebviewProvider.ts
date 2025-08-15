import * as vscode from 'vscode';
import { BackendService, CodeContextService } from '../services';
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

    constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
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
            } catch (error) {
                Logger.error('Error calling backend:', error);
                this.sendMessage({
                    type: 'answer',
                    text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
                });
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
}
