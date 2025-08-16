import * as vscode from 'vscode';
import { ChatCommands, InlineCompletionCommands } from './commands';
import {
    CodeExplanationService,
    CodeSuggestionsService,
    ConfigurationService,
    ContextAwareService,
    GhostTextService,
    InlineCompletionService,
    PatternDetectionService,
    RefactoringService,
    SemanticSearchService,
    WorkspaceAnalysisService
} from './services';
import { Logger } from './utils';
import { ChatWebviewProvider, SidebarChatProvider } from './views';

/**
 * Classe principal da extensão xCopilot
 */
export class ExtensionManager {
    private chatProvider!: ChatWebviewProvider;
    private sidebarChatProvider!: SidebarChatProvider;
    private chatCommands!: ChatCommands;
    private inlineCompletionCommands!: InlineCompletionCommands;
    private configService: ConfigurationService;
    private codeSuggestionsService!: CodeSuggestionsService;
    private codeExplanationService!: CodeExplanationService;
    private ghostTextService!: GhostTextService;
    private inlineCompletionService!: InlineCompletionService;
    private refactoringService!: RefactoringService;
    private patternDetectionService!: PatternDetectionService;

    // New context-aware services
    private workspaceAnalysisService!: WorkspaceAnalysisService;
    private contextAwareService!: ContextAwareService;
    private semanticSearchService!: SemanticSearchService;

    private outputChannel: vscode.OutputChannel;

    constructor() {
        // Inicializar output channel
        this.outputChannel = vscode.window.createOutputChannel('xCopilot');
        Logger.init(this.outputChannel);

        // Inicializar serviços
        this.configService = ConfigurationService.getInstance();
    }

    /**
     * Ativa a extensão
     */
    activate(context: vscode.ExtensionContext): void {
        Logger.info('🚀 xCopilot extension is now active!');

        try {
            // PRIMEIRO: Inicializar todos os serviços básicos
            this.codeSuggestionsService = CodeSuggestionsService.getInstance();
            this.codeExplanationService = CodeExplanationService.getInstance();
            this.ghostTextService = GhostTextService.getInstance();
            this.inlineCompletionService = InlineCompletionService.getInstance();
            this.refactoringService = RefactoringService.getInstance();
            this.patternDetectionService = PatternDetectionService.getInstance();

            // SEGUNDO: Inicializar novos serviços context-aware
            this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance(context);
            this.semanticSearchService = SemanticSearchService.getInstance(context);
            this.contextAwareService = ContextAwareService.getInstance(context);

            // TERCEIRO: Inicializar providers que dependem dos serviços
            this.chatProvider = new ChatWebviewProvider(context);
            this.sidebarChatProvider = new SidebarChatProvider(context, this.chatProvider);
            this.chatCommands = new ChatCommands(this.chatProvider);
            this.inlineCompletionCommands = new InlineCompletionCommands();

            // Inicializar context-aware service de forma assíncrona
            this.initializeContextAwareFeatures();

            // Registrar o provider da webview
            this.registerWebviewProvider(context);

            // Registrar comandos
            this.chatCommands.registerCommands(context);
            this.inlineCompletionCommands.registerCommands(context);
            this.refactoringService.registerCommands(context);
            this.patternDetectionService.registerCommands(context);
            this.registerCodeExplanationCommands(context);
            this.registerContextAwareCommands(context);

            // Registrar providers de código
            // Registrar providers de código
            this.registerCodeProviders(context);

            // Configurar monitoramento de configuração
            // this.setupConfigurationWatcher(context); // TODO: implementar se necessário

            // Adicionar output channel aos subscriptions
            context.subscriptions.push(this.outputChannel);

            Logger.info('✅ Extension activation completed successfully');

        } catch (error) {
            Logger.error('❌ CRITICAL ERROR during extension activation:', error);
            vscode.window.showErrorMessage(`Erro crítico ao ativar xCopilot: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Registra o provider da webview
     */
    private registerWebviewProvider(context: vscode.ExtensionContext): void {
        Logger.info('📝 Registering WebviewViewProvider for xcopilotPanel...');

        // Registrar provider principal (activity bar)
        const mainDisposable = vscode.window.registerWebviewViewProvider(
            'xcopilotPanel',
            this.chatProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );

        // Registrar provider do chat lateral
        const sidebarDisposable = vscode.window.registerWebviewViewProvider(
            'xcopilotChat',
            this.sidebarChatProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );

        context.subscriptions.push(mainDisposable, sidebarDisposable);
        Logger.info('✅ WebviewViewProvider registered successfully!');
    }

    /**
     * Registra os providers de código (completion, diagnostics, etc.)
     */
    private registerCodeProviders(context: vscode.ExtensionContext): void {
        Logger.info('🧠 Registering code providers...');

        // Registrar disposables dos serviços de IA
        const codeSuggestionsDisposables = this.codeSuggestionsService.getDisposables();
        const patternDetectionDisposables = this.patternDetectionService.getDisposables();
        const ghostTextDisposables = this.ghostTextService.getDisposables();
        const inlineCompletionDisposables = this.inlineCompletionService.getDisposables();

        context.subscriptions.push(
            ...codeSuggestionsDisposables,
            ...patternDetectionDisposables,
            ...ghostTextDisposables,
            ...inlineCompletionDisposables
        );

        Logger.info('✅ Code providers registered successfully!');
    }

    /**
     * Registra comandos de explicação de código
     */
    private registerCodeExplanationCommands(context: vscode.ExtensionContext): void {
        const commands = [
            vscode.commands.registerCommand('xcopilot.explainSelected', () => {
                this.codeExplanationService.explainSelectedCode();
            }),
            vscode.commands.registerCommand('xcopilot.explainFunction', () => {
                this.codeExplanationService.explainCurrentFunction();
            }),
            vscode.commands.registerCommand('xcopilot.explainFile', () => {
                this.codeExplanationService.explainEntireFile();
            }),
            vscode.commands.registerCommand('xcopilot.acceptGhostText', () => {
                this.ghostTextService.acceptGhostText();
            }),
            vscode.commands.registerCommand('xcopilot.dismissGhostText', () => {
                this.ghostTextService.dismissGhostText();
            }),
            vscode.commands.registerCommand('xcopilot.openChat', () => {
                vscode.commands.executeCommand('workbench.view.extension.xcopilot-sidebar');
                vscode.commands.executeCommand('setContext', 'xcopilot.chatVisible', true);
            }),
            vscode.commands.registerCommand('xcopilot.closeChat', () => {
                vscode.commands.executeCommand('workbench.action.closePanel');
                vscode.commands.executeCommand('setContext', 'xcopilot.chatVisible', false);
            }),
            vscode.commands.registerCommand('xcopilot.toggleChat', () => {
                vscode.commands.executeCommand('workbench.view.extension.xcopilot-sidebar');
            }),
            vscode.commands.registerCommand('xcopilot.openChatWithCode', () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && !editor.selection.isEmpty) {
                    const selectedCode = editor.document.getText(editor.selection);
                    vscode.commands.executeCommand('xcopilot.openChat');
                    this.sidebarChatProvider.openWithSelectedCode(selectedCode);
                } else {
                    vscode.window.showWarningMessage('Selecione código para explicar no chat');
                }
            })
        ];

        context.subscriptions.push(...commands);
        Logger.info('✅ Code explanation commands registered');
    }

    /**
     * Registra comandos context-aware
     */
    private registerContextAwareCommands(context: vscode.ExtensionContext): void {
        const commands = [
            // Analyze workspace
            vscode.commands.registerCommand('xcopilot.analyzeWorkspace', async () => {
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Analisando workspace...",
                        cancellable: false
                    }, async () => {
                        await this.workspaceAnalysisService.analyzeWorkspace(true);
                    });
                    vscode.window.showInformationMessage('Análise do workspace concluída!');
                } catch (error) {
                    vscode.window.showErrorMessage('Erro ao analisar workspace');
                }
            }),

            // Refresh workspace analysis
            vscode.commands.registerCommand('xcopilot.refreshWorkspaceAnalysis', async () => {
                await this.contextAwareService.refreshWorkspaceAnalysis();
            }),

            // Show workspace stats
            vscode.commands.registerCommand('xcopilot.showWorkspaceStats', () => {
                const analysis = this.workspaceAnalysisService.getCurrentAnalysis();
                if (!analysis) {
                    vscode.window.showWarningMessage('Nenhuma análise do workspace disponível. Execute "Analisar Workspace" primeiro.');
                    return;
                }

                const message = `Estatísticas do Workspace:
📁 Arquivos: ${analysis.projectStructure.totalFiles}
📝 Linhas de código: ${analysis.projectStructure.totalLines.toLocaleString()}
🏗️ Linguagem: ${analysis.architecture.language}
🔧 Frameworks: ${analysis.architecture.frameworks.join(', ') || 'Nenhum detectado'}
📦 Dependências: ${analysis.dependencies.dependencies.length}
🗂️ Diretórios: ${analysis.projectStructure.directories.length}
📅 Última análise: ${analysis.lastAnalyzed.toLocaleString()}`;

                vscode.window.showInformationMessage(message);
            }),

            // Show context stats
            vscode.commands.registerCommand('xcopilot.showContextStats', () => {
                const stats = this.contextAwareService.getContextStats();
                const cacheStats = this.semanticSearchService.getCacheStats();

                const message = `Estatísticas de Contexto:
🧠 Inicializado: ${stats.isInitialized ? 'Sim' : 'Não'}
📊 Análise disponível: ${stats.hasWorkspaceAnalysis ? 'Sim' : 'Não'}
💬 Conversas: ${stats.conversationCount}
🔍 Cache semântico: ${cacheStats.size} itens (${Math.round(cacheStats.memory / 1024)}KB)
📅 Última análise: ${stats.lastAnalysis?.toLocaleString() || 'Nunca'}`;

                vscode.window.showInformationMessage(message);
            }),

            // Clear context cache
            vscode.commands.registerCommand('xcopilot.clearContextCache', () => {
                this.workspaceAnalysisService.clearCache();
                this.semanticSearchService.clearCache();
                vscode.window.showInformationMessage('Cache de contexto limpo');
            })
        ];

        context.subscriptions.push(...commands);
        Logger.info('✅ Context-aware commands registered');
    }

    /**
     * Inicializa funcionalidades context-aware de forma assíncrona
     */
    private async initializeContextAwareFeatures(): Promise<void> {
        try {
            Logger.info('🧠 Initializing context-aware features...');

            // Initialize context-aware service in background
            await this.contextAwareService.initialize();

            Logger.info('✅ Context-aware features initialized successfully');

        } catch (error) {
            Logger.error('Error initializing context-aware features:', error);
            // Don't show error to user as this is not critical for basic functionality
        }
    }

    /**
     * Desativa a extensão
     */
    deactivate(): void {
        Logger.info('🔄 xCopilot extension is being deactivated...');
        this.outputChannel.dispose();
    }
}
