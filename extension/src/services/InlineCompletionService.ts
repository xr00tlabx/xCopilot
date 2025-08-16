import * as vscode from 'vscode';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { Logger } from '../utils/Logger';

/**
 * Serviço para completions inline em tempo real (similar ao GitHub Copilot)
 */
export class InlineCompletionService implements vscode.InlineCompletionItemProvider {
    private static instance: InlineCompletionService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private isEnabled = true;
    private disposables: vscode.Disposable[] = [];
    private lastRequestTime = 0;
    private readonly throttleMs = 500; // Throttle requests

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.registerProviders();
    }

    static getInstance(): InlineCompletionService {
        if (!InlineCompletionService.instance) {
            InlineCompletionService.instance = new InlineCompletionService();
        }
        return InlineCompletionService.instance;
    }

    /**
     * Registra os providers de completion inline
     */
    private registerProviders(): void {
        // Registrar para várias linguagens
        const selector = [
            'typescript', 'javascript', 'python', 'java', 'csharp',
            'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
        ];

        const provider = vscode.languages.registerInlineCompletionItemProvider(
            selector,
            this
        );

        this.disposables.push(provider);
        Logger.info('Inline completion provider registered');
    }

    /**
     * Implementação do VS Code InlineCompletionItemProvider
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        try {
            if (!this.isEnabled || token.isCancellationRequested) {
                return null;
            }

            // Throttle requests para evitar spam
            const now = Date.now();
            if (now - this.lastRequestTime < this.throttleMs) {
                return null;
            }
            this.lastRequestTime = now;

            const line = document.lineAt(position);
            const textBeforeCursor = line.text.substring(0, position.character);
            const textAfterCursor = line.text.substring(position.character);

            // Só sugerir se há contexto suficiente
            if (textBeforeCursor.trim().length < 2) {
                return null;
            }

            // Verificar se não está no meio de uma string ou comentário
            if (this.isInStringOrComment(textBeforeCursor)) {
                return null;
            }

            const completion = await this.generateInlineCompletion(
                document,
                position,
                textBeforeCursor,
                textAfterCursor
            );

            if (!completion || token.isCancellationRequested) {
                return null;
            }

            return [
                new vscode.InlineCompletionItem(
                    completion,
                    new vscode.Range(position, position)
                )
            ];

        } catch (error) {
            Logger.error('Error in provideInlineCompletionItems:', error);
            return null;
        }
    }

    /**
     * Gera completion inline usando IA
     */
    private async generateInlineCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        textBefore: string,
        textAfter: string
    ): Promise<string | null> {
        try {
            const context = this.contextService.getCurrentContext();

            // Obter contexto ao redor da posição atual
            const startLine = Math.max(0, position.line - 10);
            const endLine = Math.min(document.lineCount - 1, position.line + 5);
            const surroundingCode = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            const prompt = `
Complete o código seguinte de forma inteligente e contextual:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Código ao redor:
\`\`\`${document.languageId}
${surroundingCode}
\`\`\`

Linha atual antes do cursor: "${textBefore}"
Linha atual depois do cursor: "${textAfter}"

REGRAS:
1. Complete apenas o que falta na linha atual
2. Mantenha o estilo e padrões do código existente
3. Se for início de função/método, complete a assinatura
4. Se for dentro de função, complete a lógica
5. Retorne APENAS o texto de completion, sem explicações
6. Máximo 2 linhas de completion
7. Se não tiver certeza, retorne uma completion simples

Completion:`;

            const response = await this.backendService.askQuestion(prompt);

            if (!response) {
                return null;
            }

            // Limpar e processar a resposta
            let completion = response.trim();

            // Remover markdown se presente
            completion = completion.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

            // Pegar apenas as primeiras 2 linhas
            const lines = completion.split('\n').slice(0, 2);
            completion = lines.join('\n');

            // Validar que não é apenas repetição do texto existente
            if (completion === textBefore || completion.length < 2) {
                return null;
            }

            return completion;

        } catch (error) {
            Logger.error('Error generating inline completion:', error);
            return null;
        }
    }

    /**
     * Verifica se está dentro de string ou comentário
     */
    private isInStringOrComment(text: string): boolean {
        // Verificação simples para strings e comentários
        const inString = (text.match(/"/g) || []).length % 2 === 1 ||
            (text.match(/'/g) || []).length % 2 === 1 ||
            (text.match(/`/g) || []).length % 2 === 1;

        const inComment = text.includes('//') || text.includes('/*') || text.includes('#');

        return inString || inComment;
    }

    /**
     * Habilita/desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        Logger.info(`Inline completion ${enabled ? 'enabled' : 'disabled'}`);
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
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        Logger.info('Inline completion service disposed');
    }
}
