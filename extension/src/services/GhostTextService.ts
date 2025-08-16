import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { ConfigurationService } from './ConfigurationService';

/**
 * Serviço para Ghost Text - sugestões visuais em tempo real usando InlineCompletionItemProvider
 */
export class GhostTextService implements vscode.InlineCompletionItemProvider {
    private static instance: GhostTextService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private configService: ConfigurationService;
    private isEnabled = true;
    private disposables: vscode.Disposable[] = [];
    private activeEditor: vscode.TextEditor | undefined;
    private ghostTextTimeout: NodeJS.Timeout | undefined;
    private lastRequestTime = 0;
    private throttleMs = 300;
    private currentSuggestion: string | null = null;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.configService = ConfigurationService.getInstance();
        this.setupEventListeners();
        this.registerProvider();
        this.updateFromConfig();
    }

    static getInstance(): GhostTextService {
        if (!GhostTextService.instance) {
            GhostTextService.instance = new GhostTextService();
        }
        return GhostTextService.instance;
    }

    /**
     * Registra o provider de inline completion para ghost text
     */
    private registerProvider(): void {
        const selector = [
            'typescript', 'javascript', 'python', 'java', 'csharp',
            'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
        ];

        const provider = vscode.languages.registerInlineCompletionItemProvider(
            selector,
            this
        );

        this.disposables.push(provider);
        Logger.info('Ghost text inline completion provider registered');
    }

    /**
     * Atualiza configurações do serviço
     */
    private updateFromConfig(): void {
        const config = this.configService.getConfig();
        this.isEnabled = config.ghostText.enabled;
        this.throttleMs = config.ghostText.throttleMs;
        Logger.info(`Ghost text config updated: enabled=${this.isEnabled}, throttle=${this.throttleMs}ms`);
    }

    /**
     * Implementação do VS Code InlineCompletionItemProvider para Ghost Text
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        try {
            if (!this.isEnabled || token.isCancellationRequested) {
                this.setGhostTextContext(false);
                return null;
            }

            // Throttle requests
            const now = Date.now();
            if (now - this.lastRequestTime < this.throttleMs) {
                return null;
            }
            this.lastRequestTime = now;

            const line = document.lineAt(position);
            const textBeforeCursor = line.text.substring(0, position.character);
            const textAfterCursor = line.text.substring(position.character);

            // Só sugerir se há contexto suficiente e cursor está no final da linha
            if (textBeforeCursor.trim().length < 3 || position.character < line.text.length) {
                this.setGhostTextContext(false);
                return null;
            }

            // Verificar se não está em comentário ou string
            if (this.isCommentOrString(textBeforeCursor)) {
                this.setGhostTextContext(false);
                return null;
            }

            const suggestion = await this.generateCodeSuggestion(document, position);

            if (!suggestion || suggestion.trim().length === 0 || token.isCancellationRequested) {
                this.setGhostTextContext(false);
                return null;
            }

            // Store current suggestion and set context
            this.currentSuggestion = suggestion;
            this.setGhostTextContext(true);

            return [
                new vscode.InlineCompletionItem(
                    suggestion,
                    new vscode.Range(position, position)
                )
            ];

        } catch (error) {
            Logger.error('Error in ghost text provideInlineCompletionItems:', error);
            this.setGhostTextContext(false);
            return null;
        }
    }

    /**
     * Define o contexto para habilitar/desabilitar keybindings
     */
    private setGhostTextContext(visible: boolean): void {
        vscode.commands.executeCommand('setContext', 'xcopilot.ghostTextVisible', visible);
    }

    /**
     * Configura os event listeners
     */
    private setupEventListeners(): void {
        // Listener para mudanças no editor ativo
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.activeEditor = editor;
                this.setGhostTextContext(false);
            })
        );

        // Listener para mudanças no documento
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.activeEditor && event.document === this.activeEditor.document) {
                    // Clear context on document changes
                    this.setGhostTextContext(false);
                }
            })
        );

        // Listener para mudanças de configuração
        this.disposables.push(
            this.configService.onConfigurationChanged(() => {
                this.updateFromConfig();
            })
        );

        Logger.info('Ghost text event listeners setup completed');
    }

    /**
     * Gera sugestão de código inteligente usando IA
     */
    private async generateCodeSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<string | null> {
        try {
            const context = this.contextService.getCurrentContext();

            // Obter contexto ao redor da posição (mais focado que inline completion)
            const startLine = Math.max(0, position.line - 5);
            const endLine = Math.min(document.lineCount - 1, position.line + 2);
            const contextCode = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            const line = document.lineAt(position);
            const textBeforeCursor = line.text.substring(0, position.character);
            const textAfterCursor = line.text.substring(position.character);

            // Use optimized completion endpoint
            const result = await this.backendService.requestCodeCompletion({
                prompt: `
Complete o código seguinte de forma inteligente (Ghost Text):

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Código ao redor:
\`\`\`${document.languageId}
${contextCode}
\`\`\`

REGRAS PARA GHOST TEXT:
1. Complete apenas 1-2 linhas de código
2. Mantenha o estilo do código existente 
3. Seja preciso e útil
4. Para funções vazias, sugira implementação básica
5. Para condicionais, sugira o bloco lógico
6. Use indentação correta
7. Retorne APENAS o código a ser inserido

Complete:`,
                context: contextCode,
                language: document.languageId,
                textBefore: textBeforeCursor,
                textAfter: textAfterCursor
            });

            if (!result.completion) {
                return null;
            }

            let suggestion = result.completion.trim();

            // Validar e limpar sugestão
            if (suggestion.length < 2 || suggestion === textBeforeCursor.trim()) {
                return null;
            }

            // Remove code blocks if present
            suggestion = suggestion.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

            // Limit to first 2 lines
            const lines = suggestion.split('\n').slice(0, 2);
            suggestion = lines.join('\n');

            Logger.debug(`Ghost text suggestion generated: "${suggestion.substring(0, 50)}..."`);
            return suggestion;

        } catch (error) {
            Logger.error('Error generating ghost text suggestion:', error);
            return null;
        }
    }

    /**
     * Verifica se é comentário ou string
     */
    private isCommentOrString(text: string): boolean {
        const trimmed = text.trim();
        return trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('"') ||
            trimmed.startsWith("'") ||
            trimmed.startsWith('`');
    }

    /**
     * Aceita a sugestão de ghost text atual (comando Tab)
     */
    async acceptGhostText(): Promise<void> {
        if (!this.activeEditor || !this.currentSuggestion) {
            Logger.debug('No active editor or suggestion to accept');
            return;
        }

        try {
            const editor = this.activeEditor;
            const position = editor.selection.active;

            await editor.edit(editBuilder => {
                editBuilder.insert(position, this.currentSuggestion!);
            });

            // Clear suggestion and context
            this.currentSuggestion = null;
            this.setGhostTextContext(false);

            Logger.info('Ghost text suggestion accepted');

        } catch (error) {
            Logger.error('Error accepting ghost text:', error);
        }
    }

    /**
     * Rejeita a sugestão de ghost text atual (comando Esc)
     */
    dismissGhostText(): void {
        this.currentSuggestion = null;
        this.setGhostTextContext(false);
        Logger.debug('Ghost text suggestion dismissed');
    }

    /**
     * Habilita/desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.setGhostTextContext(false);
            this.currentSuggestion = null;
        }
        Logger.info(`Ghost text ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Verifica se está habilitado
     */
    isServiceEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Obtém disposables para cleanup
     */
    getDisposables(): vscode.Disposable[] {
        return this.disposables;
    }

    /**
     * Limpa recursos
     */
    dispose(): void {
        this.setGhostTextContext(false);
        this.currentSuggestion = null;

        if (this.ghostTextTimeout) {
            clearTimeout(this.ghostTextTimeout);
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        Logger.info('Ghost text service disposed');
    }
}
