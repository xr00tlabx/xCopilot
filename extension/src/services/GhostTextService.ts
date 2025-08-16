import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';

/**
 * Serviço para Ghost Text - sugestões visuais em tempo real
 */
export class GhostTextService {
    private static instance: GhostTextService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private isEnabled = true;
    private disposables: vscode.Disposable[] = [];
    private decorationType!: vscode.TextEditorDecorationType;
    private activeEditor: vscode.TextEditor | undefined;
    private ghostTextTimeout: NodeJS.Timeout | undefined;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.setupDecorations();
        this.setupEventListeners();
    }

    static getInstance(): GhostTextService {
        if (!GhostTextService.instance) {
            GhostTextService.instance = new GhostTextService();
        }
        return GhostTextService.instance;
    }

    /**
     * Configura as decorações para ghost text
     */
    private setupDecorations(): void {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic'
            }
        });
    }

    /**
     * Configura os event listeners
     */
    private setupEventListeners(): void {
        // Listener para mudanças no editor ativo
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.activeEditor = editor;
                this.clearGhostText();
            })
        );

        // Listener para mudanças no documento
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.activeEditor && event.document === this.activeEditor.document) {
                    this.scheduleGhostText();
                }
            })
        );

        // Listener para mudanças na seleção
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(event => {
                if (event.textEditor === this.activeEditor) {
                    this.scheduleGhostText();
                }
            })
        );

        Logger.info('Ghost text event listeners setup completed');
    }

    /**
     * Agenda a geração de ghost text com debounce
     */
    private scheduleGhostText(): void {
        if (!this.isEnabled || !this.activeEditor) {
            return;
        }

        // Clear timeout anterior
        if (this.ghostTextTimeout) {
            clearTimeout(this.ghostTextTimeout);
        }

        // Agendar nova geração
        this.ghostTextTimeout = setTimeout(() => {
            this.generateGhostText();
        }, 800); // 800ms de delay para evitar spam
    }

    /**
     * Gera e mostra ghost text
     */
    private async generateGhostText(): Promise<void> {
        if (!this.isEnabled || !this.activeEditor) {
            return;
        }

        try {
            const editor = this.activeEditor;
            const document = editor.document;
            const position = editor.selection.active;
            const line = document.lineAt(position);

            // Limpar ghost text anterior
            this.clearGhostText();

            // Só mostrar ghost text se o cursor está no final da linha
            if (position.character < line.text.length) {
                return;
            }

            const currentLineText = line.text.trim();

            // Só sugerir se há contexto suficiente
            if (currentLineText.length < 3) {
                return;
            }

            // Verificar se não é comentário ou string
            if (this.isCommentOrString(currentLineText)) {
                return;
            }

            const suggestion = await this.generateCodeSuggestion(document, position);

            if (suggestion && suggestion.trim().length > 0) {
                this.showGhostText(position, suggestion);
            }

        } catch (error) {
            Logger.error('Error generating ghost text:', error);
        }
    }

    /**
     * Gera sugestão de código
     */
    private async generateCodeSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<string | null> {
        try {
            const context = this.contextService.getCurrentContext();

            // Obter contexto ao redor
            const startLine = Math.max(0, position.line - 8);
            const endLine = Math.min(document.lineCount - 1, position.line + 3);
            const contextCode = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            const currentLine = document.lineAt(position).text;

            const prompt = `
Sugira uma continuação inteligente para o código seguinte:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Contexto:
\`\`\`${document.languageId}
${contextCode}
\`\`\`

Linha atual: "${currentLine}"

REGRAS:
1. Sugira apenas 1-2 linhas de código
2. Mantenha o estilo do código existente
3. Complete de forma lógica e útil
4. Se for declaração de função, sugira o corpo básico
5. Se for condicional, sugira o bloco
6. Retorne APENAS o código sugerido, sem explicações
7. Use indentação correta
8. Se não tiver certeza, não sugira nada

Sugestão:`;

            const response = await this.backendService.askQuestion(prompt);

            if (!response) {
                return null;
            }

            // Processar resposta
            let suggestion = response.trim();
            suggestion = suggestion.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

            // Pegar apenas primeiras 2 linhas
            const lines = suggestion.split('\n').slice(0, 2);
            suggestion = lines.join('\n');

            // Validar sugestão
            if (suggestion.length < 3 || suggestion === currentLine.trim()) {
                return null;
            }

            return suggestion;

        } catch (error) {
            Logger.error('Error generating code suggestion:', error);
            return null;
        }
    }

    /**
     * Mostra ghost text na posição especificada
     */
    private showGhostText(position: vscode.Position, suggestion: string): void {
        if (!this.activeEditor) {
            return;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(position, position),
            renderOptions: {
                after: {
                    contentText: ` // ${suggestion}`,
                    color: new vscode.ThemeColor('editorGhostText.foreground')
                }
            }
        };

        this.activeEditor.setDecorations(this.decorationType, [decoration]);
    }

    /**
     * Limpa ghost text ativo
     */
    private clearGhostText(): void {
        if (this.activeEditor) {
            this.activeEditor.setDecorations(this.decorationType, []);
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
     * Aceita a sugestão de ghost text atual
     */
    async acceptGhostText(): Promise<void> {
        if (!this.activeEditor) {
            return;
        }

        try {
            const editor = this.activeEditor;
            const position = editor.selection.active;

            // Obter a decoração atual (simulação - VS Code não expõe isso diretamente)
            // Em uma implementação real, manteria a sugestão em memória
            const suggestion = await this.generateCodeSuggestion(editor.document, position);

            if (suggestion) {
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, `\n${suggestion}`);
                });

                this.clearGhostText();
            }

        } catch (error) {
            Logger.error('Error accepting ghost text:', error);
        }
    }

    /**
     * Habilita/desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.clearGhostText();
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
        this.clearGhostText();

        if (this.ghostTextTimeout) {
            clearTimeout(this.ghostTextTimeout);
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];

        if (this.decorationType) {
            this.decorationType.dispose();
        }

        Logger.info('Ghost text service disposed');
    }
}
