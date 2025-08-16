import * as vscode from 'vscode';
import { ChatWebviewProvider } from './ChatWebviewProvider';
import { Logger } from '../utils/Logger';

/**
 * Provider para o chat lateral do xCopilot (similar ao GitHub Copilot)
 */
export class SidebarChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'xcopilotChat';
    private webview?: vscode.Webview;
    private chatProvider: ChatWebviewProvider;

    constructor(
        private readonly context: vscode.ExtensionContext,
        chatProvider: ChatWebviewProvider
    ) {
        this.chatProvider = chatProvider;
    }

    /**
     * Resolve a webview view
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this.webview = webviewView.webview;

        // Configurar webview
        this.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist')
            ]
        };

        // Definir HTML inicial
        this.webview.html = this.getWebviewContent(this.webview);

        // Configurar listeners de mensagens
        this.setupMessageHandlers();

        Logger.info('Sidebar chat provider resolved');
    }

    /**
     * Configura os handlers de mensagens
     */
    private setupMessageHandlers(): void {
        if (!this.webview) return;

        this.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case 'askQuestion':
                        await this.handleAskQuestion(message.prompt, message.includeContext);
                        break;
                    case 'explainCode':
                        await this.handleExplainCode(message.code);
                        break;
                    case 'clearChat':
                        this.clearChat();
                        break;
                    case 'ready':
                        this.sendMessage({
                            type: 'initialize',
                            data: { ready: true }
                        });
                        break;
                }
            } catch (error) {
                Logger.error('Error handling sidebar message:', error);
                this.sendMessage({
                    type: 'error',
                    message: 'Erro ao processar mensagem'
                });
            }
        });
    }

    /**
     * Processa pergunta do usuário
     */
    private async handleAskQuestion(prompt: string, includeContext: boolean): Promise<void> {
        try {
            // Mostrar indicador de carregamento
            this.sendMessage({
                type: 'loading',
                loading: true
            });

            // Usar BackendService diretamente como no ChatWebviewProvider
            const backendService = this.chatProvider['backendService'];
            const contextService = this.chatProvider['contextService'];

            let finalPrompt = prompt;

            if (includeContext) {
                const context = contextService.getContextWithFallback(10);
                if (context && contextService.hasUsefulContext()) {
                    finalPrompt = contextService.formatContextForPrompt(context, prompt);
                }
            }

            const response = await backendService.askQuestion(finalPrompt);

            // Enviar resposta
            this.sendMessage({
                type: 'response',
                response: response,
                prompt: prompt
            });

        } catch (error) {
            Logger.error('Error processing question:', error);
            this.sendMessage({
                type: 'error',
                message: 'Erro ao processar pergunta'
            });
        } finally {
            this.sendMessage({
                type: 'loading',
                loading: false
            });
        }
    }

    /**
     * Explica código selecionado
     */
    private async handleExplainCode(code: string): Promise<void> {
        try {
            this.sendMessage({
                type: 'loading',
                loading: true
            });

            // Usar BackendService diretamente
            const backendService = this.chatProvider['backendService'];
            const prompt = `Explique o seguinte código de forma detalhada:\n\`\`\`\n${code}\n\`\`\``;
            const response = await backendService.askQuestion(prompt);

            this.sendMessage({
                type: 'response',
                response: response,
                prompt: `Explicar código: ${code.substring(0, 50)}...`
            });

        } catch (error) {
            Logger.error('Error explaining code:', error);
            this.sendMessage({
                type: 'error',
                message: 'Erro ao explicar código'
            });
        } finally {
            this.sendMessage({
                type: 'loading',
                loading: false
            });
        }
    }

    /**
     * Limpa o chat
     */
    private clearChat(): void {
        this.sendMessage({
            type: 'clear'
        });
    }

    /**
     * Envia mensagem para a webview
     */
    private sendMessage(message: any): void {
        if (this.webview) {
            this.webview.postMessage(message);
        }
    }

    /**
     * Abre chat com código selecionado
     */
    public openWithSelectedCode(code: string): void {
        this.sendMessage({
            type: 'setInput',
            text: `Explique este código:\n\`\`\`\n${code}\n\`\`\``
        });
    }

    /**
     * Abre chat com pergunta específica
     */
    public openWithQuestion(question: string): void {
        this.sendMessage({
            type: 'setInput',
            text: question
        });
    }

    /**
     * Gera o conteúdo HTML da webview
     */
    private getWebviewContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>xCopilot Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--vscode-sideBar-background);
        }

        .header h3 {
            margin: 0;
            color: var(--vscode-sideBarTitle-foreground);
        }

        .clear-btn {
            background: none;
            border: none;
            color: var(--vscode-button-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
        }

        .clear-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            max-width: 100%;
            word-wrap: break-word;
        }

        .message.user {
            align-self: flex-end;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px 12px;
            border-radius: 12px 12px 4px 12px;
            max-width: 85%;
        }

        .message.assistant {
            align-self: flex-start;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px 12px;
            border-radius: 12px 12px 12px 4px;
            max-width: 95%;
        }

        .message pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 4px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }

        .message code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .input-container {
            padding: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
        }

        .input-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .input-area {
            flex: 1;
            min-height: 34px;
            max-height: 100px;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            resize: none;
            outline: none;
        }

        .input-area:focus {
            border-color: var(--vscode-focusBorder);
        }

        .send-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            height: 34px;
            font-weight: 500;
        }

        .send-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .loading {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .spinner {
            width: 12px;
            height: 12px;
            border: 2px solid var(--vscode-progressBar-background);
            border-top: 2px solid var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .context-checkbox {
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .context-checkbox input {
            margin: 0;
        }

        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }

        .empty-state h4 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .suggestions {
            display: grid;
            gap: 8px;
            margin-top: 16px;
            width: 100%;
            max-width: 300px;
        }

        .suggestion {
            padding: 8px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            transition: background-color 0.2s;
            font-size: 12px;
        }

        .suggestion:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>💬 xCopilot Chat</h3>
        <button class="clear-btn" onclick="clearChat()">🗑️ Limpar</button>
    </div>
    
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="empty-state">
                <h4>🤖 Como posso ajudar?</h4>
                <p>Faça uma pergunta sobre programação ou selecione código para explicar.</p>
                <div class="suggestions">
                    <div class="suggestion" onclick="askSuggestion('Como criar uma função em Python?')">
                        Como criar uma função?
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Explique esse padrão de design')">
                        Explicar padrão de design
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Como otimizar este código?')">
                        Otimizar código
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Gerar testes unitários')">
                        Gerar testes
                    </div>
                </div>
            </div>
        </div>
        
        <div class="input-container">
            <div class="input-row">
                <textarea 
                    id="messageInput" 
                    class="input-area" 
                    placeholder="Faça uma pergunta sobre programação..."
                    rows="1"
                ></textarea>
                <button id="sendBtn" class="send-btn" onclick="sendMessage()">📤</button>
            </div>
            <div class="context-checkbox">
                <input type="checkbox" id="includeContext" checked>
                <label for="includeContext">Incluir contexto do arquivo atual</label>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let isLoading = false;

        // Auto-resize textarea
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        // Send on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Message handlers
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'response':
                    addMessage('user', message.prompt);
                    addMessage('assistant', message.response);
                    break;
                case 'loading':
                    handleLoading(message.loading);
                    break;
                case 'error':
                    addMessage('assistant', '❌ ' + message.message);
                    break;
                case 'clear':
                    clearMessages();
                    break;
                case 'setInput':
                    document.getElementById('messageInput').value = message.text;
                    messageInput.style.height = 'auto';
                    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
                    messageInput.focus();
                    break;
            }
        });

        function sendMessage() {
            if (isLoading) return;
            
            const input = document.getElementById('messageInput');
            const includeContext = document.getElementById('includeContext').checked;
            const message = input.value.trim();
            
            if (!message) return;
            
            vscode.postMessage({
                type: 'askQuestion',
                prompt: message,
                includeContext: includeContext
            });
            
            input.value = '';
            input.style.height = 'auto';
        }

        function clearChat() {
            clearMessages();
            vscode.postMessage({ type: 'clearChat' });
        }

        function askSuggestion(question) {
            document.getElementById('messageInput').value = question;
            sendMessage();
        }

        function addMessage(type, content) {
            const messagesContainer = document.getElementById('messages');
            const emptyState = messagesContainer.querySelector('.empty-state');
            
            if (emptyState) {
                emptyState.remove();
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}\`;
            
            // Process markdown-like formatting
            let processedContent = content
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                .replace(/\\n/g, '<br>');
            
            messageDiv.innerHTML = processedContent;
            messagesContainer.appendChild(messageDiv);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function clearMessages() {
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = \`
                <div class="empty-state">
                    <h4>🤖 Como posso ajudar?</h4>
                    <p>Faça uma pergunta sobre programação ou selecione código para explicar.</p>
                    <div class="suggestions">
                        <div class="suggestion" onclick="askSuggestion('Como criar uma função em Python?')">
                            Como criar uma função?
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Explique esse padrão de design')">
                            Explicar padrão de design
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Como otimizar este código?')">
                            Otimizar código
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Gerar testes unitários')">
                            Gerar testes
                        </div>
                    </div>
                </div>
            \`;
        }

        function handleLoading(loading) {
            isLoading = loading;
            const sendBtn = document.getElementById('sendBtn');
            const messagesContainer = document.getElementById('messages');
            
            if (loading) {
                sendBtn.disabled = true;
                
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.innerHTML = '<div class="spinner"></div> Pensando...';
                loadingDiv.id = 'loading-indicator';
                messagesContainer.appendChild(loadingDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                sendBtn.disabled = false;
                const loadingIndicator = document.getElementById('loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
            }
        }

        // Initialize
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}
