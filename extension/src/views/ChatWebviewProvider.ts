import * as vscode from 'vscode';
import { BackendService } from '../services/BackendService';
import { ContextAwareService } from '../services/ContextAwareService';
import { ChatMessage } from '../types';
import { Logger } from '../utils/Logger';
import { getChatHtml } from './WebviewHtml';

/**
 * Provedor da webview para o chat do xCopilot
 */
export class ChatWebviewProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private backendService: BackendService;
    private contextAwareService: ContextAwareService;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.backendService = BackendService.getInstance();
        this.contextAwareService = ContextAwareService.getInstance(context);
        
        // Initialize the context-aware service
        if (this.contextAwareService) {
            this.contextAwareService.initialize().catch(error => {
                Logger.error('Failed to initialize ContextAwareService:', error);
            });
        }
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
            Logger.info(`Processing context-aware ask request: ${message.prompt}`);

            // Enviar resposta inicial
            this.sendMessage({ type: 'answer', text: 'Analisando contexto e pensando...' });

            try {
                // Get conversation context using ContextAwareService
                const conversationContext = await this.contextAwareService.getConversationContext(message.prompt);
                
                // Send context-aware request to backend
                const answer = await this.sendContextAwareRequest(message.prompt, conversationContext);
                
                this.sendMessage({ type: 'answer', text: answer });
            } catch (error) {
                Logger.error('Error calling context-aware backend:', error);
                this.sendMessage({
                    type: 'answer',
                    text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
                });
            }
        }
    }

    /**
     * Send context-aware request to backend
     */
    private async sendContextAwareRequest(userMessage: string, context: any): Promise<string> {
        const backendUrl = this.backendService['configService'].getBackendUrl().replace('/openai', '/api/context-chat');
        
        Logger.info(`Sending context-aware request to: ${backendUrl}`);
        
        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    userMessage,
                    context 
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                Logger.error(`Backend error: ${response.status} - ${errorText}`);
                return `Erro HTTP ${response.status}: ${errorText}`;
            }

            const data = await response.json();
            Logger.debug('Context-aware response received successfully');

            // Log context usage for debugging
            if (data.contextUsed) {
                Logger.info(`Context used - Current: ${data.contextUsed.hasCurrentContext}, Files: ${data.contextUsed.relevantFilesCount}, History: ${data.contextUsed.hasConversationHistory}, Workspace: ${data.contextUsed.hasWorkspaceContext}`);
            }

            return data.response || data.resposta || JSON.stringify(data);

        } catch (error: any) {
            Logger.error('Network error in context-aware request:', error);

            if (error.code === 'ECONNREFUSED') {
                return `Erro: Não foi possível conectar ao backend em ${backendUrl}. Verifique se o servidor está rodando.`;
            }

            return `Falha na requisição: ${error.message}`;
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
