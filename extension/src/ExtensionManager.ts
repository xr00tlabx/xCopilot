import * as vscode from 'vscode';
import { ChatCommands } from './commands';
import {
    CodeExplanationService,
    CodeSuggestionsService,
    ConfigurationService,
    ContextAwareService,
    GhostTextService,
    InlineCompletionService,
    PatternDetectionService,
    RefactoringService,
    VectorEmbeddingService
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
    private configService: ConfigurationService;
    private codeSuggestionsService!: CodeSuggestionsService;
    private codeExplanationService!: CodeExplanationService;
    private contextAwareService!: ContextAwareService;
    private vectorEmbeddingService!: VectorEmbeddingService;
    private ghostTextService!: GhostTextService;
    private inlineCompletionService!: InlineCompletionService;
    private refactoringService!: RefactoringService;
    private patternDetectionService!: PatternDetectionService;
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
    async activate(context: vscode.ExtensionContext): Promise<void> {
        Logger.info('🚀 xCopilot extension is now active!');

        try {
            // Inicializar providers com contexto
            this.chatProvider = new ChatWebviewProvider(context);
            this.sidebarChatProvider = new SidebarChatProvider(context, this.chatProvider);
            this.chatCommands = new ChatCommands(this.chatProvider);

            // Inicializar todos os serviços IA
            this.contextAwareService = ContextAwareService.getInstance();
            this.vectorEmbeddingService = VectorEmbeddingService.getInstance();
            this.codeSuggestionsService = CodeSuggestionsService.getInstance();
            this.codeExplanationService = CodeExplanationService.getInstance();
            this.ghostTextService = GhostTextService.getInstance();
            this.inlineCompletionService = InlineCompletionService.getInstance();
            this.refactoringService = RefactoringService.getInstance();
            this.patternDetectionService = PatternDetectionService.getInstance();

            // Initialize context-aware service
            await this.contextAwareService.initialize(context);

            // Registrar o provider da webview
            this.registerWebviewProvider(context);

            // Registrar comandos
            this.chatCommands.registerCommands(context);
            this.refactoringService.registerCommands(context);
            this.patternDetectionService.registerCommands(context);
            this.registerCodeExplanationCommands(context);

            // Registrar providers de código
            // Registrar providers de código
            this.registerCodeProviders(context);

            // Configurar monitoramento de configuração
            this.setupConfigurationWatcher(context);

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
            }),
            vscode.commands.registerCommand('xcopilot.analyzeWorkspace', async () => {
                vscode.window.showInformationMessage('Analisando workspace...');
                try {
                    const analysis = await this.contextAwareService.analyzeWorkspace();
                    const message = `Análise do Workspace concluída:
Linguagens: ${analysis.projectStructure.languages.join(', ')}
Frameworks: ${analysis.projectStructure.frameworks.join(', ')}
Dependências: ${analysis.dependencies.length}
Padrões detectados: ${analysis.patterns.length}`;
                    vscode.window.showInformationMessage(message);
                } catch (error) {
                    vscode.window.showErrorMessage(`Erro na análise: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                }
            }),
            vscode.commands.registerCommand('xcopilot.reindexWorkspace', async () => {
                vscode.window.showInformationMessage('Re-indexando workspace...');
                try {
                    await this.vectorEmbeddingService.initializeWorkspace();
                    const status = this.vectorEmbeddingService.getIndexingStatus();
                    vscode.window.showInformationMessage(`Re-indexação concluída. ${status.indexedFiles} arquivos indexados.`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Erro na re-indexação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                }
            }),
            vscode.commands.registerCommand('xcopilot.showWorkspaceInsights', async () => {
                const analysis = this.contextAwareService.getWorkspaceAnalysis();
                if (analysis) {
                    const insights = `📊 Insights do Workspace:

🏗️ Arquitetura:
- Linguagens: ${analysis.projectStructure.languages.join(', ')}
- Frameworks: ${analysis.projectStructure.frameworks.join(', ')}
- Diretórios principais: ${analysis.projectStructure.mainDirectories.join(', ')}

📦 Dependências: ${analysis.dependencies.length} encontradas

🎯 Padrões detectados:
${analysis.patterns.map(p => `- ${p.name} (${(p.confidence * 100).toFixed(0)}%)`).join('\n')}

📝 Convenções:
${analysis.conventions.map(c => `- ${c.rule}`).join('\n')}`;

                    vscode.window.showInformationMessage(insights, { modal: true });
                } else {
                    vscode.window.showWarningMessage('Análise do workspace ainda não foi concluída. Execute "xCopilot: Analisar Workspace" primeiro.');
                }
            })
        ];

        context.subscriptions.push(...commands);
        Logger.info('✅ Code explanation commands registered');
    }

    /**
     * Configura monitoramento de configuração
     */
    private setupConfigurationWatcher(context: vscode.ExtensionContext): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('xcopilot')) {
                Logger.info('xCopilot configuration changed');
                // Recarregar configurações se necessário
            }
        });

        context.subscriptions.push(configWatcher);
    }

    /**
     * Desativa a extensão
     */
    deactivate(): void {
        Logger.info('🛑 xCopilot extension deactivated');
    }
}
