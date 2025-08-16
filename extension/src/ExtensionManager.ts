import * as vscode from 'vscode';
import { ChatCommands } from './commands';
import {
    CodeExplanationService,
    CodeReviewService,
    CodeSuggestionsService,
    ConfigurationService,
    ConversationHistoryService,
    GhostTextService,
    InlineCompletionService,
    MultilineGenerationService,
    PatternDetectionService,
    RefactoringCodeLensProvider,
    RefactoringService,
    WorkspaceAnalysisService
} from './services';
import { Logger } from './utils';
import { ChatWebviewProvider, SidebarChatProvider } from './views';

// Single coherent implementation of ExtensionManager (defensive, minimal side-effects)
export class ExtensionManager {
    private chatProvider?: ChatWebviewProvider;
    private sidebarChatProvider?: SidebarChatProvider;
    private chatCommands?: ChatCommands;
    private configService: ConfigurationService;
    private conversationHistoryService?: ConversationHistoryService;
    private codeSuggestionsService?: CodeSuggestionsService;
    private codeExplanationService?: CodeExplanationService;
    private codeReviewService?: CodeReviewService;
    private ghostTextService?: GhostTextService;
    private inlineCompletionService?: InlineCompletionService;
    private multilineGenerationService?: MultilineGenerationService;
    private refactoringService?: RefactoringService;
    private patternDetectionService?: PatternDetectionService;
    private refactoringCodeLensProvider?: RefactoringCodeLensProvider;
    private workspaceAnalysisService?: WorkspaceAnalysisService;
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

            // Optional service singletons (may be undefined in some builds)
            this.codeSuggestionsService = CodeSuggestionsService.getInstance?.();
            this.codeExplanationService = CodeExplanationService.getInstance?.();
            this.codeReviewService = CodeReviewService.getInstance?.();
            this.ghostTextService = GhostTextService.getInstance?.();
            this.inlineCompletionService = InlineCompletionService.getInstance?.();
            this.multilineGenerationService = MultilineGenerationService.getInstance?.();
            this.refactoringService = RefactoringService.getInstance?.();
            this.patternDetectionService = PatternDetectionService.getInstance?.();
            this.refactoringCodeLensProvider = RefactoringCodeLensProvider.getInstance?.();
            this.workspaceAnalysisService = WorkspaceAnalysisService.getInstance?.();

            // Register components
            this.registerWebviewProvider(context);
            this.chatCommands?.registerCommands?.(context);
            this.refactoringService?.registerCommands?.(context);
            this.patternDetectionService?.registerCommands?.(context);
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
        const disposables: vscode.Disposable[] = [];
        disposables.push(vscode.commands.registerCommand('xcopilot.explainSelected', () => this.codeExplanationService?.explainSelectedCode()));
        disposables.push(vscode.commands.registerCommand('xcopilot.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.xcopilot-sidebar');
            vscode.commands.executeCommand('setContext', 'xcopilot.chatVisible', true);
        }));
        context.subscriptions.push(...disposables);
    }

    private setupConfigurationWatcher(context: vscode.ExtensionContext): void {
        const watcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('xcopilot')) {
                try {
                    this.inlineCompletionService?.updateFromConfig?.();
                    this.refactoringCodeLensProvider?.refresh?.();
                    this.codeSuggestionsService?.refresh?.();
                    Logger.info('Services updated with new configuration');
                } catch (error) {
                    Logger.error('Error updating services configuration:', error);
                }
            }
        });
        context.subscriptions.push(watcher);
    }

    deactivate(): void {
        try {
            this.outputChannel.dispose();
        } catch (err) {
            Logger.error('Deactivate error', err);
        }
    }

    private startWorkspaceAnalysis(): void {
        setTimeout(async () => {
            try {
                await this.workspaceAnalysisService?.analyzeWorkspaceOnStartup?.();
            } catch (err) {
                Logger.error('Workspace analysis failed', err);
            }
        }, 3000);
    }
}
