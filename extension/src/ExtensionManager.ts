import * as vscode from 'vscode';
import { ChatCommands } from './commands';
import {
    CodeExplanationService,
    CodeSuggestionsService,
    ConfigurationService,
    ConversationHistoryService,
    GhostTextService,
    InlineCompletionService,
    MultilineGenerationService,
    PatternDetectionService,
    RefactoringCodeLensProvider,
    RefactoringService
} from './services';
import { WorkspaceAnalysisService } from './services/WorkspaceAnalysisService';
import { Logger } from './utils';
import { ChatWebviewProvider, SidebarChatProvider } from './views';

// Single coherent implementation of ExtensionManager (defensive, minimal side-effects)
export class ExtensionManager {
    private chatProvider!: ChatWebviewProvider;
    private sidebarChatProvider!: SidebarChatProvider;
    private chatCommands!: ChatCommands;
    private configService: ConfigurationService;
    private conversationHistoryService!: ConversationHistoryService;
    private codeSuggestionsService!: CodeSuggestionsService;
    private codeExplanationService!: CodeExplanationService;
    private ghostTextService!: GhostTextService;
    private inlineCompletionService!: InlineCompletionService;
    private multilineGenerationService!: MultilineGenerationService;
    private refactoringService!: RefactoringService;
    private patternDetectionService!: PatternDetectionService;
    private refactoringCodeLensProvider!: RefactoringCodeLensProvider;
    private workspaceAnalysisService!: WorkspaceAnalysisService;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('xCopilot');
        Logger.init(this.outputChannel);
        this.configService = ConfigurationService.getInstance();
    }

    async activate(context: vscode.ExtensionContext): Promise<void> {
        Logger.info('xCopilot activate');
        try {
            // Core services
            this.conversationHistoryService = ConversationHistoryService.getInstance?.(context);

            // UI providers
            this.chatProvider = new ChatWebviewProvider();
            this.sidebarChatProvider = new SidebarChatProvider(context, this.chatProvider);
            this.chatCommands = new ChatCommands(this.chatProvider);

            // Inicializar todos os serviços IA
            this.conversationHistoryService = ConversationHistoryService.getInstance();
            this.codeSuggestionsService = CodeSuggestionsService.getInstance();
            this.codeExplanationService = CodeExplanationService.getInstance();
            this.ghostTextService = GhostTextService.getInstance();
            this.inlineCompletionService = InlineCompletionService.getInstance();
            this.multilineGenerationService = MultilineGenerationService.getInstance();
            this.refactoringService = RefactoringService.getInstance();
            this.patternDetectionService = PatternDetectionService.getInstance();
            this.refactoringCodeLensProvider = RefactoringCodeLensProvider.getInstance();
            this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance();

            // Register components
            this.registerWebviewProvider(context);

            // Registrar comandos
            this.chatCommands.registerCommands(context);
            this.refactoringService.registerCommands(context);
            this.patternDetectionService.registerCommands(context);
            this.registerCodeExplanationCommands(context);
            this.registerCodeProviders(context);

            this.refactoringCodeLensProvider?.register?.(context);
            this.setupConfigurationWatcher(context);
            this.startWorkspaceAnalysis();

            context.subscriptions.push(this.outputChannel);
            Logger.info('xCopilot activated');
        } catch (err) {
            Logger.error('Activation error', err);
            vscode.window.showErrorMessage('Erro crítico ao ativar xCopilot');
        }
    }

    private registerWebviewProvider(context: vscode.ExtensionContext): void {
        if (!this.chatProvider || !this.sidebarChatProvider) return;
        try {
            const mainDisposable = vscode.window.registerWebviewViewProvider('xcopilotPanel', this.chatProvider, {
                webviewOptions: { retainContextWhenHidden: true }
            });
            const sidebarDisposable = vscode.window.registerWebviewViewProvider('xcopilotChat', this.sidebarChatProvider, {
                webviewOptions: { retainContextWhenHidden: true }
            });
            context.subscriptions.push(mainDisposable, sidebarDisposable);
        } catch (err) {
            Logger.error('Failed to register webview providers', err);
        }
    }

    private registerCodeProviders(context: vscode.ExtensionContext): void {
        try {
            const codeSuggestionsDisposables = this.codeSuggestionsService?.getDisposables?.() ?? [];
            const patternDetectionDisposables = this.patternDetectionService?.getDisposables?.() ?? [];
            const ghostTextDisposables = this.ghostTextService?.getDisposables?.() ?? [];
            const inlineCompletionDisposables = this.inlineCompletionService?.getDisposables?.() ?? [];
            context.subscriptions.push(...codeSuggestionsDisposables, ...patternDetectionDisposables, ...ghostTextDisposables, ...inlineCompletionDisposables);
        } catch (err) {
            Logger.error('Failed to register code providers', err);
        }
    }

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
            }),
            vscode.commands.registerCommand('xcopilot.toggleInlineCompletion', () => {
                const currentState = this.inlineCompletionService.isServiceEnabled();
                this.inlineCompletionService.setEnabled(!currentState);
                vscode.window.showInformationMessage(
                    `Inline Completion ${!currentState ? 'habilitado' : 'desabilitado'}`
                );
            }),
            vscode.commands.registerCommand('xcopilot.clearCompletionCache', () => {
                this.inlineCompletionService.clearCache();
                vscode.window.showInformationMessage('Cache de completions limpo');
            }),
            vscode.commands.registerCommand('xcopilot.showCompletionStats', () => {
                const stats = this.inlineCompletionService.getStats();
                const message = `Estatísticas de Completion:
Requisições: ${stats.requestCount}
Cache Hits: ${stats.cacheHits}
Taxa de Cache: ${stats.cacheHitRate.toFixed(1)}%
Cache: ${stats.cacheStats.size}/${stats.cacheStats.capacity} (${stats.cacheStats.utilization.toFixed(1)}%)`;
                vscode.window.showInformationMessage(message);
            })
        ];

        context.subscriptions.push(...commands);
        Logger.info('✅ Code explanation commands registered');
    }

    /**
     * Configura monitoramento de mudanças na configuração
     */
    private setupConfigurationWatcher(context: vscode.ExtensionContext): void {
        // Monitorar mudanças na configuração da extensão
        const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('xcopilot')) {
                Logger.info('🔄 Configuration changed, updating services...');

        // Atualizar configurações dos serviços
                try {
                    this.inlineCompletionService?.updateFromConfig();
                    this.refactoringCodeLensProvider?.refresh();
                    Logger.info('Services updated with new configuration');
                } catch (error) {
                    Logger.error('Error updating services configuration:', error);
                }
            }
        });

        context.subscriptions.push(configWatcher);
        Logger.info('✅ Configuration watcher setup completed');
    }

    /**
     * Inicia análise do workspace
     */
    private startWorkspaceAnalysis(): void {
        // Executar análise em background após um delay
        setTimeout(async () => {
            try {
                await this.workspaceAnalysisService.analyzeWorkspaceOnStartup();
            } catch (error) {
                Logger.error('Error during workspace analysis startup:', error);
            }
        }, 3000); // 3 segundos de delay para não interferir na inicialização
    }
}
