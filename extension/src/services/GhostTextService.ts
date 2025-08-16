import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { ConfigurationService } from './ConfigurationService';

interface GhostTextSuggestion {
    text: string;
    explanation?: string;
    confidence: number;
    type: 'single-line' | 'multi-line' | 'function' | 'block';
    rank: number;
}

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
    private currentSuggestion: GhostTextSuggestion | null = null;
    private lastRequestTime = 0;
    private debounceMs = 500;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.configService = ConfigurationService.getInstance();
        this.updateFromConfig();
        this.setupEventListeners();
        this.registerProvider();
    }

    static getInstance(): GhostTextService {
        if (!GhostTextService.instance) {
            GhostTextService.instance = new GhostTextService();
        }
        return GhostTextService.instance;
    }

    /**
     * Update settings from configuration
     */
    private updateFromConfig(): void {
        const config = vscode.workspace.getConfiguration('xcopilot');
        this.isEnabled = config.get('ghostText.enabled', true);
        this.debounceMs = config.get('ghostText.debounceMs', 500);
        
        Logger.info(`Ghost text config updated: enabled=${this.isEnabled}, debounce=${this.debounceMs}ms`);
    }

    /**
     * Register the inline completion provider
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
     * VS Code InlineCompletionItemProvider implementation
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | null> {
        try {
            if (!this.isEnabled || token.isCancellationRequested) {
                return null;
            }

            // Throttle requests
            const now = Date.now();
            if (now - this.lastRequestTime < this.debounceMs) {
                return null;
            }
            this.lastRequestTime = now;

            const line = document.lineAt(position);
            const textBefore = line.text.substring(0, position.character);
            const textAfter = line.text.substring(position.character);

            // Only suggest if cursor is at end of line or in whitespace
            if (position.character < line.text.length && textAfter.trim().length > 0) {
                return null;
            }

            // Don't suggest in comments or strings
            if (this.isInCommentOrString(textBefore)) {
                return null;
            }

            // Generate ghost text suggestion
            const suggestion = await this.generateGhostTextSuggestion(document, position);
            if (!suggestion || token.isCancellationRequested) {
                return null;
            }

            this.currentSuggestion = suggestion;

            // Set context for keybindings
            vscode.commands.executeCommand('setContext', 'xcopilot.ghostTextVisible', true);

            const item = new vscode.InlineCompletionItem(
                suggestion.text,
                new vscode.Range(position, position)
            );

            // Add command to show explanation on hover if enabled
            const config = vscode.workspace.getConfiguration('xcopilot');
            if (config.get('ghostText.showPreview', true) && suggestion.explanation) {
                item.command = {
                    command: 'xcopilot.showGhostTextPreview',
                    title: 'Preview Ghost Text',
                    arguments: [suggestion.explanation]
                };
            }

            return [item];

        } catch (error) {
            Logger.error('Error in provideInlineCompletionItems:', error);
            return null;
        }
    }

    /**
     * Configura os event listeners
     */
    private setupEventListeners(): void {
        // Listener para mudanças no editor ativo
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.activeEditor = editor;
                this.clearGhostTextContext();
            })
        );

        // Configuration change listener
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('xcopilot.ghostText')) {
                    this.updateFromConfig();
                }
            })
        );

        Logger.info('Ghost text event listeners setup completed');
    }

    /**
     * Clear ghost text context
     */
    private clearGhostTextContext(): void {
        this.currentSuggestion = null;
        vscode.commands.executeCommand('setContext', 'xcopilot.ghostTextVisible', false);
    }

    /**
     * Generate ghost text suggestion with ranking and context analysis
     */
    private async generateGhostTextSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<GhostTextSuggestion | null> {
        try {
            const context = this.contextService.getCurrentContext();
            const config = vscode.workspace.getConfiguration('xcopilot');

            // Get surrounding context
            const contextLines = 10;
            const startLine = Math.max(0, position.line - contextLines);
            const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
            const surroundingCode = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            const currentLine = document.lineAt(position).text;
            const currentLineText = currentLine.substring(0, position.character);

            // Determine suggestion type
            const suggestionType = this.determineSuggestionType(currentLineText, document.languageId);
            const maxLines = config.get('ghostText.maxLines', 5);
            const multiLineEnabled = config.get('ghostText.multiLine', true);

            const prompt = this.buildGhostTextPrompt(
                document.languageId,
                context?.fileName || 'unknown',
                surroundingCode,
                currentLineText,
                suggestionType,
                multiLineEnabled ? maxLines : 1
            );

            const response = await this.backendService.askQuestion(prompt);

            if (!response) {
                return null;
            }

            // Process response
            let suggestionText = this.processSuggestionResponse(response, maxLines);
            
            if (!suggestionText || suggestionText.length < 2) {
                return null;
            }

            // Generate explanation if preview is enabled
            let explanation = '';
            if (config.get('ghostText.showPreview', true)) {
                explanation = await this.generateSuggestionExplanation(suggestionText, suggestionType);
            }

            // Calculate confidence and ranking
            const confidence = this.calculateConfidence(suggestionText, currentLineText, suggestionType);
            const rank = this.calculateRank(suggestionText, confidence, suggestionType);

            return {
                text: suggestionText,
                explanation,
                confidence,
                type: suggestionType,
                rank
            };

        } catch (error) {
            Logger.error('Error generating ghost text suggestion:', error);
            return null;
        }
    }

    /**
     * Determine the type of suggestion needed based on context
     */
    private determineSuggestionType(currentText: string, language: string): GhostTextSuggestion['type'] {
        const trimmed = currentText.trim();

        // Multi-line patterns (check first for classes, interfaces)
        if (trimmed.includes('class ') || trimmed.includes('interface ') || 
            trimmed.includes('struct ') || trimmed.includes('enum ')) {
            return 'multi-line';
        }

        // Check for block statements  
        if (trimmed.includes('if ') || trimmed.includes('for ') || 
            trimmed.includes('while ') || trimmed.includes('try ') ||
            (trimmed.includes('{') && !trimmed.includes('function ') && !trimmed.includes('class '))) {
            return 'block';
        }

        // Function declarations
        if (language === 'javascript' || language === 'typescript') {
            if (trimmed.includes('function ') || trimmed.includes('=> {') || 
                (trimmed.endsWith(') {') && trimmed.includes('function'))) {
                return 'function';
            }
        }

        if (language === 'python') {
            if (trimmed.startsWith('def ') && trimmed.endsWith(':')) {
                return 'function';
            }
        }

        // Check for block endings
        if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
            return 'block';
        }

        return 'single-line';
    }

    /**
     * Build optimized prompt for ghost text generation
     */
    private buildGhostTextPrompt(
        language: string,
        fileName: string,
        context: string,
        currentLine: string,
        type: GhostTextSuggestion['type'],
        maxLines: number
    ): string {
        const typeDescription = {
            'single-line': 'uma única linha de código',
            'multi-line': `até ${maxLines} linhas de código`,
            'function': `o corpo de uma função (máximo ${maxLines} linhas)`,
            'block': `um bloco de código (máximo ${maxLines} linhas)`
        };

        return `
Gere uma sugestão de ghost text contextual para ${typeDescription[type]}:

Linguagem: ${language}
Arquivo: ${fileName}
Tipo: ${type}

Contexto do código:
\`\`\`${language}
${context}
\`\`\`

Linha atual: "${currentLine}"

REGRAS IMPORTANTES:
1. Sugerir ${typeDescription[type]} que complete logicamente o código
2. Manter o estilo de código existente (indentação, convenções)
3. Ser contextualmente relevante e útil
4. Para funções/blocos, incluir estrutura básica mas não implementação completa
5. Para linha única, completar a declaração/chamada atual
6. NÃO incluir explicações, apenas o código
7. NÃO repetir código já existente
8. Usar indentação adequada para o contexto

Sugestão:`;
    }

    /**
     * Process and clean the suggestion response
     */
    private processSuggestionResponse(response: string, maxLines: number): string {
        let suggestion = response.trim();
        
        // Remove code block markers
        suggestion = suggestion.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        
        // Split into lines and limit
        const lines = suggestion.split('\n');
        const limitedLines = lines.slice(0, maxLines);
        
        // Clean each line
        const cleanLines = limitedLines.map(line => line.trimEnd());
        
        return cleanLines.join('\n');
    }

    /**
     * Generate explanation for the suggestion
     */
    private async generateSuggestionExplanation(
        suggestion: string,
        type: GhostTextSuggestion['type']
    ): Promise<string> {
        try {
            const prompt = `
Explique brevemente (máximo 50 palavras) o que faz esta sugestão de código:

Tipo: ${type}
Código:
\`\`\`
${suggestion}
\`\`\`

Explicação concisa:`;

            const response = await this.backendService.askQuestion(prompt);
            return response?.trim() || '';
        } catch (error) {
            Logger.error('Error generating explanation:', error);
            return '';
        }
    }

    /**
     * Calculate confidence score for the suggestion
     */
    private calculateConfidence(
        suggestion: string,
        currentText: string,
        type: GhostTextSuggestion['type']
    ): number {
        let confidence = 0.5; // Base confidence

        // Higher confidence for more specific contexts
        if (type === 'function') confidence += 0.2;
        if (type === 'block') confidence += 0.15;
        
        // Adjust based on suggestion quality
        if (suggestion.length > 10) confidence += 0.1;
        if (suggestion.includes('\n')) confidence += 0.05;
        
        // Lower confidence if too similar to current text
        if (suggestion.toLowerCase().includes(currentText.toLowerCase())) {
            confidence -= 0.2;
        }

        return Math.max(0.1, Math.min(1.0, confidence));
    }

    /**
     * Calculate ranking score for suggestion ordering
     */
    private calculateRank(
        suggestion: string,
        confidence: number,
        type: GhostTextSuggestion['type']
    ): number {
        let rank = confidence * 100;

        // Bonus for certain types
        if (type === 'function') rank += 20;
        if (type === 'block') rank += 15;

        // Bonus for multi-line suggestions (more complete)
        if (suggestion.includes('\n')) rank += 10;

        return Math.round(rank);
    }

    /**
     * Check if position is in comment or string
     */
    private isInCommentOrString(text: string): boolean {
        // Basic check for strings and comments
        const inString = (text.match(/"/g) || []).length % 2 === 1 ||
            (text.match(/'/g) || []).length % 2 === 1 ||
            (text.match(/`/g) || []).length % 2 === 1;

        const inComment = text.includes('//') || text.includes('/*') || text.includes('#');

        return inString || inComment;
    }

    /**
     * Accept the current ghost text suggestion
     */
    async acceptGhostText(): Promise<void> {
        if (!this.activeEditor || !this.currentSuggestion) {
            return;
        }

        try {
            const editor = this.activeEditor;
            const position = editor.selection.active;

            // Insert the suggestion
            await editor.edit(editBuilder => {
                editBuilder.insert(position, this.currentSuggestion!.text);
            });

            // Clear the context
            this.clearGhostTextContext();

            Logger.info('Ghost text suggestion accepted');

        } catch (error) {
            Logger.error('Error accepting ghost text:', error);
        }
    }

    /**
     * Reject the current ghost text suggestion
     */
    async rejectGhostText(): Promise<void> {
        this.clearGhostTextContext();
        Logger.info('Ghost text suggestion rejected');
    }

    /**
     * Show preview/explanation of current suggestion
     */
    async showGhostTextPreview(explanation: string): Promise<void> {
        if (explanation) {
            vscode.window.showInformationMessage(
                `Ghost Text Preview: ${explanation}`,
                'Accept (Tab)', 'Reject (Esc)'
            ).then(selection => {
                if (selection === 'Accept (Tab)') {
                    this.acceptGhostText();
                } else if (selection === 'Reject (Esc)') {
                    this.rejectGhostText();
                }
            });
        }
    }

    /**
     * Toggle ghost text service
     */
    toggleGhostText(): void {
        this.setEnabled(!this.isEnabled);
        vscode.window.showInformationMessage(
            `Ghost Text ${this.isEnabled ? 'habilitado' : 'desabilitado'}`
        );
    }

    /**
     * Enable/disable the service
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.clearGhostTextContext();
        }
        Logger.info(`Ghost text ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if service is enabled
     */
    isServiceEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get service statistics
     */
    getStats(): { enabled: boolean; hasCurrentSuggestion: boolean; suggestionType?: string } {
        return {
            enabled: this.isEnabled,
            hasCurrentSuggestion: this.currentSuggestion !== null,
            suggestionType: this.currentSuggestion?.type
        };
    }

    /**
     * Get disposables for cleanup
     */
    getDisposables(): vscode.Disposable[] {
        return this.disposables;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.clearGhostTextContext();

        if (this.ghostTextTimeout) {
            clearTimeout(this.ghostTextTimeout);
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        Logger.info('Ghost text service disposed');
    }
}
