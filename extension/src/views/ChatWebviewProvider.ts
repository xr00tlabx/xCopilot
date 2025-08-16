import * as vscode from 'vscode';
import { BackendService } from '../services/BackendService';
import { WorkspaceAnalysisService } from '../services/WorkspaceAnalysisService';
import { ConversationHistoryService } from '../services/ConversationHistoryService';
import { ChatMessage } from '../types';
import { Logger } from '../utils/Logger';
import { getChatHtml } from './WebviewHtml';

/**
 * Provedor da webview para o chat do xCopilot
 */
export class ChatWebviewProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private backendService: BackendService;
    private workspaceAnalysisService: WorkspaceAnalysisService;
    private conversationHistoryService: ConversationHistoryService;

    constructor() {
        this.backendService = BackendService.getInstance();
        this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance();
        this.conversationHistoryService = ConversationHistoryService.getInstance();
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
                // Usar contexto do workspace para resposta mais inteligente
                const contextualPrompt = this.workspaceAnalysisService.formatContextForPrompt(message.prompt);
                
                // Adicionar contexto de conversas anteriores (últimas 5)
                const recentConversations = this.conversationHistoryService.getRecentConversations(5);
                let finalPrompt = contextualPrompt;
                
                if (recentConversations.length > 0) {
                    const conversationContext = recentConversations.map(conv => 
                        `Q: ${conv.prompt}\nA: ${conv.response.substring(0, 200)}...`
                    ).join('\n\n');
                    
                    finalPrompt = `[CONVERSATION HISTORY]\n${conversationContext}\n\n${contextualPrompt}`;
                }
                
                const answer = await this.backendService.askQuestion(finalPrompt);
                
                // Salvar conversa no histórico
                this.conversationHistoryService.addConversation({
                    id: Date.now().toString(),
                    prompt: message.prompt,
                    response: answer,
                    timestamp: new Date(),
                    context: 'chat'
                });
                
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
