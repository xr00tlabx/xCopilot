import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';

/**
 * Serviço para sugestões de código em tempo real
 */
export class CodeSuggestionsService {
    private static instance: CodeSuggestionsService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private isEnabled = true;
    private suggestionProvider: vscode.Disposable | undefined;
    private diagnosticCollection: vscode.DiagnosticCollection;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('xcopilot-suggestions');
        this.initializeProviders();
    }

    static getInstance(): CodeSuggestionsService {
        if (!CodeSuggestionsService.instance) {
            CodeSuggestionsService.instance = new CodeSuggestionsService();
        }
        return CodeSuggestionsService.instance;
    }

    /**
     * Inicializa os providers de sugestões
     */
    private initializeProviders(): void {
        // Provider de completion items
        this.suggestionProvider = vscode.languages.registerCompletionItemProvider(
            ['typescript', 'javascript', 'python', 'java', 'csharp'],
            {
                provideCompletionItems: async (document, position, token, context) => {
                    return this.provideCodeCompletions(document, position, context);
                }
            },
            '.', ' ', '(', '{'
        );

        // Listener para mudanças no documento
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (this.isEnabled) {
                await this.analyzeCodeChanges(event);
            }
        });

        Logger.info('Code suggestions service initialized');
    }

    /**
     * Fornece sugestões de código
     */
    private async provideCodeCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        try {
            if (!this.isEnabled) {
                return [];
            }

            const lineText = document.lineAt(position).text;
            const beforeCursor = lineText.substring(0, position.character);

            // Só sugerir se há contexto suficiente
            if (beforeCursor.trim().length < 3) {
                return [];
            }

            const context_info = this.contextService.getCurrentContext();
            const suggestions = await this.generateCodeSuggestions(beforeCursor, context_info);

            return suggestions.map((suggestion, index) => {
                const item = new vscode.CompletionItem(
                    suggestion.text,
                    vscode.CompletionItemKind.Snippet
                );
                item.detail = suggestion.description;
                item.documentation = new vscode.MarkdownString(suggestion.explanation);
                item.insertText = new vscode.SnippetString(suggestion.text);
                item.sortText = `00${index}`;
                return item;
            });

        } catch (error) {
            Logger.error('Error providing code completions:', error);
            return [];
        }
    }

    /**
     * Gera sugestões de código usando IA
     */
    private async generateCodeSuggestions(
        codePrefix: string,
        context: any
    ): Promise<Array<{ text: string, description: string, explanation: string }>> {
        try {
            const prompt = `
Como um assistente de código especializado, analise o contexto e forneça 3 sugestões de código relevantes:

Código atual: ${codePrefix}
Arquivo: ${context.fileName || 'unknown'}
Linguagem: ${context.fileType || 'unknown'}

Contexto do arquivo:
${context.surroundingLines || ''}

Forneça sugestões no formato JSON:
[
  {
    "text": "código sugerido",
    "description": "breve descrição",
    "explanation": "explicação detalhada"
  }
]

Foque em:
- Completar a linha atual logicamente
- Sugerir padrões comuns da linguagem
- Considerar o contexto do arquivo
- Usar boas práticas de programação
`;

            const response = await this.backendService.askQuestion(prompt);

            // Tentar extrair JSON da resposta
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return [];
        } catch (error) {
            Logger.error('Error generating code suggestions:', error);
            return [];
        }
    }

    /**
     * Analisa mudanças no código para fornecer sugestões proativas
     */
    private async analyzeCodeChanges(event: vscode.TextDocumentChangeEvent): Promise<void> {
        try {
            const document = event.document;

            // Só analisar arquivos de código
            if (!this.isSupportedLanguage(document.languageId)) {
                return;
            }

            // Debounce - só analisar após 2 segundos de inatividade
            setTimeout(async () => {
                await this.performCodeAnalysis(document);
            }, 2000);

        } catch (error) {
            Logger.error('Error analyzing code changes:', error);
        }
    }

    /**
     * Realiza análise completa do código
     */
    private async performCodeAnalysis(document: vscode.TextDocument): Promise<void> {
        try {
            const text = document.getText();
            const diagnostics: vscode.Diagnostic[] = [];

            // Analisar padrões de código
            const patterns = await this.detectCodePatterns(text, document.languageId);

            for (const pattern of patterns) {
                if (pattern.severity === 'warning' || pattern.severity === 'info') {
                    const diagnostic = new vscode.Diagnostic(
                        pattern.range,
                        pattern.message,
                        pattern.severity === 'warning'
                            ? vscode.DiagnosticSeverity.Warning
                            : vscode.DiagnosticSeverity.Information
                    );
                    diagnostic.source = 'xCopilot AI';
                    diagnostic.code = pattern.code;
                    diagnostics.push(diagnostic);
                }
            }

            this.diagnosticCollection.set(document.uri, diagnostics);

        } catch (error) {
            Logger.error('Error performing code analysis:', error);
        }
    }

    /**
     * Detecta padrões no código
     */
    private async detectCodePatterns(
        code: string,
        language: string
    ): Promise<Array<{
        range: vscode.Range,
        message: string,
        severity: 'error' | 'warning' | 'info',
        code: string,
        suggestion?: string
    }>> {
        try {
            const prompt = `
Analise o código ${language} abaixo e detecte padrões, problemas potenciais e oportunidades de melhoria:

\`\`\`${language}
${code}
\`\`\`

Retorne sugestões no formato JSON:
[
  {
    "line": número_da_linha,
    "message": "descrição do problema/sugestão",
    "severity": "warning|info",
    "code": "código_identificador",
    "suggestion": "sugestão de melhoria"
  }
]

Foque em:
- Código duplicado
- Funções muito longas
- Variáveis mal nomeadas
- Padrões ineficientes
- Oportunidades de refatoração
- Boas práticas da linguagem
`;

            const response = await this.backendService.askQuestion(prompt);

            // Extrair JSON da resposta
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const patterns = JSON.parse(jsonMatch[0]);

                return patterns.map((pattern: any) => ({
                    range: new vscode.Range(
                        Math.max(0, pattern.line - 1),
                        0,
                        Math.max(0, pattern.line - 1),
                        100
                    ),
                    message: pattern.message,
                    severity: pattern.severity as 'warning' | 'info',
                    code: pattern.code,
                    suggestion: pattern.suggestion
                }));
            }

            return [];
        } catch (error) {
            Logger.error('Error detecting code patterns:', error);
            return [];
        }
    }

    /**
     * Verifica se a linguagem é suportada
     */
    private isSupportedLanguage(languageId: string): boolean {
        const supportedLanguages = [
            'typescript', 'javascript', 'python', 'java', 'csharp',
            'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
        ];
        return supportedLanguages.includes(languageId);
    }

    /**
     * Habilita/desabilita sugestões
     */
    toggle(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.diagnosticCollection.clear();
        }
        Logger.info(`Code suggestions ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Obtém sugestões para uma seleção específica
     */
    async getSuggestionsForSelection(
        document: vscode.TextDocument,
        selection: vscode.Selection
    ): Promise<string[]> {
        try {
            const selectedText = document.getText(selection);
            const context = this.contextService.getCurrentContext();

            const prompt = `
Analise o código selecionado e forneça 3-5 sugestões de melhoria:

Código selecionado:
\`\`\`${document.languageId}
${selectedText}
\`\`\`

Contexto do arquivo:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Tipo: ${context?.fileType || 'desconhecido'}
- Posição: linha ${context?.lineNumbers?.start || 0}-${context?.lineNumbers?.end || 0}

Forneça sugestões específicas de:
1. Otimização de performance
2. Melhoria de legibilidade
3. Aplicação de boas práticas
4. Refatoração de código
5. Correção de possíveis bugs

Retorne apenas uma lista de sugestões claras e objetivas.
`;

            const response = await this.backendService.askQuestion(prompt);

            // Dividir resposta em sugestões individuais
            return response
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => line.replace(/^\d+\.?\s*/, '').trim())
                .filter(suggestion => suggestion.length > 10);

        } catch (error) {
            Logger.error('Error getting suggestions for selection:', error);
            return [];
        }
    }

    /**
     * Obtém os disposables para limpeza
     */
    getDisposables(): vscode.Disposable[] {
        const disposables = [];
        if (this.suggestionProvider) {
            disposables.push(this.suggestionProvider);
        }
        disposables.push(this.diagnosticCollection);
        return disposables;
    }

    /**
     * Limpa recursos
     */
    dispose(): void {
        this.suggestionProvider?.dispose();
        this.diagnosticCollection.dispose();
    }
}
