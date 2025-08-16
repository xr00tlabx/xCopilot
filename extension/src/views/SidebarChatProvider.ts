import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ChatWebviewProvider } from './ChatWebviewProvider';
import { ContextAwareService, WorkspaceAnalysisService } from '../services';
import { ConversationContext } from '../types';

/**
 * Provider para o chat lateral do xCopilot (similar ao GitHub Copilot)
 */
export class SidebarChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'xcopilotChat';
    private webview?: vscode.Webview;
    private chatProvider: ChatWebviewProvider;
    private contextAwareService: ContextAwareService;
    private workspaceAnalysisService: WorkspaceAnalysisService;

    constructor(
        private readonly context: vscode.ExtensionContext,
        chatProvider: ChatWebviewProvider
    ) {
        this.chatProvider = chatProvider;
        this.contextAwareService = ContextAwareService.getInstance(context);
        this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance(context);
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
                        await this.handleReady();
                        break;
                    case 'refreshContext':
                        await this.handleRefreshContext();
                        break;
                    case 'executeSuggestion':
                        await this.handleExecuteSuggestion(message.suggestionId);
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
     * Processa pergunta do usuário com context-aware features
     */
    private async handleAskQuestion(prompt: string, includeContext: boolean): Promise<void> {
        try {
            // Mostrar indicador de carregamento
            this.sendMessage({
                type: 'loading',
                loading: true
            });

            // Get enhanced context-aware prompt
            let conversationContext: ConversationContext | null = null;
            let finalResponse: string;
            let contextUsed: any = {};

            if (includeContext) {
                // Use context-aware service for enhanced context
                conversationContext = await this.contextAwareService.getConversationContext(prompt);
                
                // Send context indicators to UI
                this.sendContextUpdate(conversationContext);

                // Use enhanced backend method with full context
                const backendService = this.chatProvider['backendService'];
                const result = await backendService.askQuestionWithContext({
                    prompt,
                    workspaceContext: conversationContext.workspaceAnalysis ? {
                        language: conversationContext.workspaceAnalysis.architecture.language,
                        frameworks: conversationContext.workspaceAnalysis.architecture.frameworks,
                        totalFiles: conversationContext.workspaceAnalysis.projectStructure.totalFiles,
                        architecturePattern: conversationContext.workspaceAnalysis.architecture.pattern
                    } : null,
                    conversationHistory: conversationContext.recentConversations,
                    gitInfo: conversationContext.gitInfo,
                    codeContext: {
                        currentFile: conversationContext.currentFile,
                        relevantCode: conversationContext.relevantCode
                    }
                });

                finalResponse = result.response;
                contextUsed = result.contextUsed;

            } else {
                // Use simple backend method
                const backendService = this.chatProvider['backendService'];
                finalResponse = await backendService.askQuestion(prompt);
            }

            // Enviar resposta com contexto
            this.sendMessage({
                type: 'response',
                response: finalResponse,
                prompt: prompt,
                context: conversationContext ? {
                    hasWorkspaceAnalysis: !!conversationContext.workspaceAnalysis,
                    hasGitInfo: !!conversationContext.gitInfo,
                    suggestionCount: conversationContext.suggestions.length,
                    memoryItems: conversationContext.recentConversations.length,
                    contextUsed
                } : undefined
            });

            // Send suggestions if available
            if (conversationContext?.suggestions && conversationContext.suggestions.length > 0) {
                this.sendMessage({
                    type: 'suggestions',
                    suggestions: conversationContext.suggestions.slice(0, 3)
                });
            }

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
     * Manipula evento ready do webview
     */
    private async handleReady(): Promise<void> {
        // Send initial context information
        const contextStats = this.contextAwareService.getContextStats();
        const analysis = this.workspaceAnalysisService.getCurrentAnalysis();
        
        this.sendMessage({
            type: 'initialize',
            data: { 
                ready: true,
                contextStats,
                hasWorkspaceAnalysis: !!analysis,
                projectInfo: analysis ? {
                    language: analysis.architecture.language,
                    frameworks: analysis.architecture.frameworks,
                    totalFiles: analysis.projectStructure.totalFiles
                } : null
            }
        });
    }

    /**
     * Atualiza contexto do workspace
     */
    private async handleRefreshContext(): Promise<void> {
        try {
            this.sendMessage({
                type: 'loading',
                loading: true
            });

            await this.contextAwareService.refreshWorkspaceAnalysis();
            
            const analysis = this.workspaceAnalysisService.getCurrentAnalysis();
            this.sendMessage({
                type: 'contextRefreshed',
                data: {
                    hasWorkspaceAnalysis: !!analysis,
                    projectInfo: analysis ? {
                        language: analysis.architecture.language,
                        frameworks: analysis.architecture.frameworks,
                        totalFiles: analysis.projectStructure.totalFiles,
                        lastAnalyzed: analysis.lastAnalyzed
                    } : null
                }
            });

        } catch (error) {
            Logger.error('Error refreshing context:', error);
            this.sendMessage({
                type: 'error',
                message: 'Erro ao atualizar contexto'
            });
        } finally {
            this.sendMessage({
                type: 'loading',
                loading: false
            });
        }
    }

    /**
     * Executa sugestão contextual
     */
    private async handleExecuteSuggestion(suggestionId: string): Promise<void> {
        try {
            // Find suggestion and execute its action
            const context = await this.contextAwareService.getConversationContext('');
            const suggestion = context.suggestions.find(s => s.id === suggestionId);
            
            if (suggestion?.action) {
                await vscode.commands.executeCommand(suggestion.action);
                this.sendMessage({
                    type: 'suggestionExecuted',
                    suggestionId
                });
            }
        } catch (error) {
            Logger.error('Error executing suggestion:', error);
            this.sendMessage({
                type: 'error',
                message: 'Erro ao executar sugestão'
            });
        }
    }

    /**
     * Envia atualizações de contexto para o UI
     */
    private sendContextUpdate(context: ConversationContext): void {
        this.sendMessage({
            type: 'contextUpdate',
            data: {
                hasWorkspace: !!context.workspaceAnalysis,
                hasGit: !!context.gitInfo,
                memoryItems: context.recentConversations.length,
                codeItems: context.relevantCode.length,
                currentFile: context.currentFile?.fileName || null,
                projectLanguage: context.workspaceAnalysis?.architecture.language || null
            }
        });
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
     * Gera o conteúdo HTML da webview com context indicators
     */
    private getWebviewContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>xCopilot Context-Aware Chat</title>
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
            background-color: var(--vscode-sideBar-background);
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h3 {
            margin: 0;
            color: var(--vscode-sideBarTitle-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .context-indicators {
            margin-top: 8px;
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .context-indicator {
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .context-indicator.active {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-button-foreground);
        }

        .context-indicator.inactive {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            opacity: 0.6;
        }

        .context-indicator.loading {
            background-color: var(--vscode-charts-orange);
            color: var(--vscode-button-foreground);
        }

        .clear-btn, .refresh-btn {
            background: none;
            border: none;
            color: var(--vscode-button-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 4px;
        }

        .clear-btn:hover, .refresh-btn:hover {
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

        .message-context {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .context-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 1px 4px;
            border-radius: 3px;
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

        .suggestions-container {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .suggestions-title {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }

        .contextual-suggestions {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .contextual-suggestion {
            padding: 6px 8px;
            background-color: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s;
        }

        .contextual-suggestion:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .suggestion-relevance {
            background-color: var(--vscode-charts-blue);
            color: white;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 9px;
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

        .context-options {
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .context-option {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .context-option input {
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

        .project-info {
            margin-top: 8px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
            font-size: 11px;
            border: 1px solid var(--vscode-input-border);
        }

        .project-info-title {
            font-weight: bold;
            margin-bottom: 4px;
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
        <div class="header-top">
            <h3>🧠 xCopilot Context-Aware</h3>
            <div>
                <button class="refresh-btn" onclick="refreshContext()" title="Atualizar contexto">🔄</button>
                <button class="clear-btn" onclick="clearChat()">🗑️</button>
            </div>
        </div>
        <div class="context-indicators" id="contextIndicators">
            <div class="context-indicator inactive">
                <span>🏗️</span> Workspace
            </div>
            <div class="context-indicator inactive">
                <span>🔀</span> Git
            </div>
            <div class="context-indicator inactive">
                <span>💭</span> Memory
            </div>
            <div class="context-indicator inactive">
                <span>📁</span> File
            </div>
        </div>
    </div>
    
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="empty-state">
                <h4>🤖 Context-Aware Assistant</h4>
                <p>Agora com consciência total do seu projeto!</p>
                <div class="project-info" id="projectInfo" style="display: none;">
                    <div class="project-info-title">📊 Projeto</div>
                    <div id="projectDetails">Carregando informações...</div>
                </div>
                <div class="suggestions">
                    <div class="suggestion" onclick="askSuggestion('Como a arquitetura deste projeto está organizada?')">
                        Arquitetura do projeto
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Quais são as principais dependências do projeto?')">
                        Dependências
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Como posso melhorar este código baseado no padrão do projeto?')">
                        Melhorar código
                    </div>
                    <div class="suggestion" onclick="askSuggestion('Gerar testes seguindo o padrão do projeto')">
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
                    placeholder="Pergunte qualquer coisa sobre o projeto..."
                    rows="1"
                ></textarea>
                <button id="sendBtn" class="send-btn" onclick="sendMessage()">📤</button>
            </div>
            <div class="context-options">
                <div class="context-option">
                    <input type="checkbox" id="includeContext" checked>
                    <label for="includeContext">Usar contexto do projeto</label>
                </div>
                <div class="context-option">
                    <input type="checkbox" id="includeMemory" checked>
                    <label for="includeMemory">Incluir memória de conversas</label>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let isLoading = false;
        let currentSuggestions = [];

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
                case 'initialize':
                    handleInitialize(message.data);
                    break;
                case 'response':
                    addMessage('user', message.prompt);
                    addMessage('assistant', message.response, message.context);
                    break;
                case 'suggestions':
                    showContextualSuggestions(message.suggestions);
                    break;
                case 'contextUpdate':
                    updateContextIndicators(message.data);
                    break;
                case 'contextRefreshed':
                    handleContextRefreshed(message.data);
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
                case 'suggestionExecuted':
                    highlightExecutedSuggestion(message.suggestionId);
                    break;
            }
        });

        function handleInitialize(data) {
            if (data.projectInfo) {
                showProjectInfo(data.projectInfo);
            }
            if (data.contextStats) {
                updateInitialContextIndicators(data.contextStats);
            }
        }

        function showProjectInfo(projectInfo) {
            const projectInfoDiv = document.getElementById('projectInfo');
            const projectDetails = document.getElementById('projectDetails');
            
            projectDetails.innerHTML = \`
                <strong>\${projectInfo.language}</strong><br>
                \${projectInfo.frameworks.join(', ') || 'Nenhum framework detectado'}<br>
                <small>\${projectInfo.totalFiles} arquivos</small>
            \`;
            
            projectInfoDiv.style.display = 'block';
        }

        function updateInitialContextIndicators(contextStats) {
            const indicators = document.getElementById('contextIndicators');
            const children = indicators.children;
            
            // Update workspace indicator
            if (contextStats.hasWorkspaceAnalysis) {
                children[0].className = 'context-indicator active';
            }
            
            // Update memory indicator
            if (contextStats.conversationCount > 0) {
                children[2].className = 'context-indicator active';
                children[2].innerHTML = '<span>💭</span> Memory (' + contextStats.conversationCount + ')';
            }
        }

        function updateContextIndicators(contextData) {
            const indicators = document.getElementById('contextIndicators');
            const children = indicators.children;
            
            // Workspace indicator
            children[0].className = contextData.hasWorkspace ? 'context-indicator active' : 'context-indicator inactive';
            
            // Git indicator
            children[1].className = contextData.hasGit ? 'context-indicator active' : 'context-indicator inactive';
            
            // Memory indicator
            children[2].className = contextData.memoryItems > 0 ? 'context-indicator active' : 'context-indicator inactive';
            if (contextData.memoryItems > 0) {
                children[2].innerHTML = '<span>💭</span> Memory (' + contextData.memoryItems + ')';
            }
            
            // File indicator
            children[3].className = contextData.currentFile ? 'context-indicator active' : 'context-indicator inactive';
            if (contextData.currentFile) {
                const fileName = contextData.currentFile.split('/').pop();
                children[3].innerHTML = '<span>📁</span> ' + fileName;
            }
        }

        function handleContextRefreshed(data) {
            if (data.projectInfo) {
                showProjectInfo(data.projectInfo);
            }
            addMessage('assistant', '✅ Contexto do projeto atualizado!');
        }

        function showContextualSuggestions(suggestions) {
            currentSuggestions = suggestions;
            const messagesContainer = document.getElementById('messages');
            
            const suggestionsContainer = document.createElement('div');
            suggestionsContainer.className = 'suggestions-container';
            suggestionsContainer.innerHTML = \`
                <div class="suggestions-title">💡 Sugestões contextuais:</div>
                <div class="contextual-suggestions">
                    \${suggestions.map(suggestion => \`
                        <div class="contextual-suggestion" onclick="executeSuggestion('\${suggestion.id}')">
                            <div>
                                <strong>\${suggestion.title}</strong><br>
                                <small>\${suggestion.description}</small>
                            </div>
                            <div class="suggestion-relevance">\${Math.round(suggestion.relevance * 100)}%</div>
                        </div>
                    \`).join('')}
                </div>
            \`;
            
            messagesContainer.appendChild(suggestionsContainer);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function executeSuggestion(suggestionId) {
            vscode.postMessage({
                type: 'executeSuggestion',
                suggestionId: suggestionId
            });
        }

        function highlightExecutedSuggestion(suggestionId) {
            // Find and highlight the executed suggestion
            const suggestionElements = document.querySelectorAll('.contextual-suggestion');
            suggestionElements.forEach(el => {
                if (el.onclick.toString().includes(suggestionId)) {
                    el.style.backgroundColor = 'var(--vscode-charts-green)';
                    el.style.color = 'white';
                    setTimeout(() => {
                        el.style.backgroundColor = '';
                        el.style.color = '';
                    }, 2000);
                }
            });
        }

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

        function refreshContext() {
            vscode.postMessage({ type: 'refreshContext' });
        }

        function askSuggestion(question) {
            document.getElementById('messageInput').value = question;
            sendMessage();
        }

        function addMessage(type, content, context) {
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
            
            // Add context information for assistant messages
            if (type === 'assistant' && context) {
                const contextDiv = document.createElement('div');
                contextDiv.className = 'message-context';
                
                const badges = [];
                if (context.hasWorkspaceAnalysis) badges.push('<span class="context-badge">🏗️ Workspace</span>');
                if (context.hasGitInfo) badges.push('<span class="context-badge">🔀 Git</span>');
                if (context.memoryItems > 0) badges.push('<span class="context-badge">💭 ' + context.memoryItems + ' memories</span>');
                if (context.suggestionCount > 0) badges.push('<span class="context-badge">💡 ' + context.suggestionCount + ' suggestions</span>');
                
                contextDiv.innerHTML = badges.join('');
                messageDiv.appendChild(contextDiv);
            }
            
            messagesContainer.appendChild(messageDiv);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function clearMessages() {
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = \`
                <div class="empty-state">
                    <h4>🤖 Context-Aware Assistant</h4>
                    <p>Agora com consciência total do seu projeto!</p>
                    <div class="project-info" id="projectInfo" style="display: none;">
                        <div class="project-info-title">📊 Projeto</div>
                        <div id="projectDetails">Carregando informações...</div>
                    </div>
                    <div class="suggestions">
                        <div class="suggestion" onclick="askSuggestion('Como a arquitetura deste projeto está organizada?')">
                            Arquitetura do projeto
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Quais são as principais dependências do projeto?')">
                            Dependências
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Como posso melhorar este código baseado no padrão do projeto?')">
                            Melhorar código
                        </div>
                        <div class="suggestion" onclick="askSuggestion('Gerar testes seguindo o padrão do projeto')">
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
                
                // Update context indicators to show loading
                const indicators = document.getElementById('contextIndicators');
                const children = indicators.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].className.includes('active')) {
                        children[i].className = 'context-indicator loading';
                    }
                }
                
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.innerHTML = '<div class="spinner"></div> Analisando contexto...';
                loadingDiv.id = 'loading-indicator';
                messagesContainer.appendChild(loadingDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                sendBtn.disabled = false;
                
                // Restore context indicators
                const indicators = document.getElementById('contextIndicators');
                const children = indicators.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i].className.includes('loading')) {
                        children[i].className = 'context-indicator active';
                    }
                }
                
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
