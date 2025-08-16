import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';

/**
 * Serviço para explicações detalhadas de código
 */
export class CodeExplanationService {
    private static instance: CodeExplanationService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.outputChannel = vscode.window.createOutputChannel('xCopilot - Code Explanation');
    }

    static getInstance(): CodeExplanationService {
        if (!CodeExplanationService.instance) {
            CodeExplanationService.instance = new CodeExplanationService();
        }
        return CodeExplanationService.instance;
    }

    /**
     * Explica código selecionado
     */
    async explainSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText.trim()) {
            vscode.window.showWarningMessage('Selecione um código para explicar');
            return;
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando código...',
                cancellable: true
            }, async (progress, token) => {
                const explanation = await this.generateDetailedExplanation(
                    editor.document,
                    selectedText,
                    selection
                );

                if (token.isCancellationRequested) {
                    return;
                }

                this.showExplanation(explanation, selectedText, editor.document.languageId);
            });

        } catch (error) {
            Logger.error('Error explaining code:', error);
            vscode.window.showErrorMessage('Erro ao explicar código');
        }
    }

    /**
     * Explica função/método atual
     */
    async explainCurrentFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const functionCode = await this.getFunctionAtCursor(editor);

            if (!functionCode) {
                vscode.window.showWarningMessage('Nenhuma função encontrada na posição atual');
                return;
            }

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando função...',
                cancellable: true
            }, async (progress, token) => {
                const explanation = await this.generateFunctionExplanation(
                    editor.document,
                    functionCode
                );

                if (token.isCancellationRequested) {
                    return;
                }

                this.showExplanation(explanation, functionCode, editor.document.languageId);
            });

        } catch (error) {
            Logger.error('Error explaining function:', error);
            vscode.window.showErrorMessage('Erro ao explicar função');
        }
    }

    /**
     * Explica arquivo completo
     */
    async explainEntireFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        const document = editor.document;
        const fileContent = document.getText();

        if (fileContent.length > 5000) {
            const choice = await vscode.window.showWarningMessage(
                'Arquivo muito grande. Isso pode demorar. Continuar?',
                'Sim', 'Não'
            );

            if (choice !== 'Sim') {
                return;
            }
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando arquivo...',
                cancellable: true
            }, async (progress, token) => {
                const explanation = await this.generateFileExplanation(document);

                if (token.isCancellationRequested) {
                    return;
                }

                this.showExplanation(explanation, fileContent, document.languageId);
            });

        } catch (error) {
            Logger.error('Error explaining file:', error);
            vscode.window.showErrorMessage('Erro ao explicar arquivo');
        }
    }

    /**
     * Gera explicação detalhada
     */
    private async generateDetailedExplanation(
        document: vscode.TextDocument,
        code: string,
        selection: vscode.Selection
    ): Promise<string> {
        const context = this.contextService.getCurrentContext();

        // Obter contexto ao redor da seleção
        const startLine = Math.max(0, selection.start.line - 5);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + 5);
        const surroundingCode = document.getText(
            new vscode.Range(startLine, 0, endLine, 0)
        );

        const prompt = `
Forneça uma explicação detalhada e educativa do código selecionado:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Código selecionado:
\`\`\`${document.languageId}
${code}
\`\`\`

Contexto ao redor:
\`\`\`${document.languageId}
${surroundingCode}
\`\`\`

Por favor, forneça uma explicação que inclua:

1. **Propósito**: O que este código faz
2. **Como funciona**: Explicação linha por linha (se necessário)
3. **Conceitos**: Conceitos de programação utilizados
4. **Padrões**: Padrões de design ou boas práticas
5. **Possíveis melhorias**: Sugestões de otimização
6. **Complexidade**: Análise de complexidade (se aplicável)
7. **Dependências**: Bibliotecas ou módulos utilizados

Use uma linguagem clara e educativa, adequada para desenvolvedores de diferentes níveis.`;

        const response = await this.backendService.askQuestion(prompt);
        return response || 'Não foi possível gerar explicação para este código.';
    }

    /**
     * Gera explicação de função
     */
    private async generateFunctionExplanation(
        document: vscode.TextDocument,
        functionCode: string
    ): Promise<string> {
        const context = this.contextService.getCurrentContext();

        const prompt = `
Analise e explique esta função de forma detalhada:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Função:
\`\`\`${document.languageId}
${functionCode}
\`\`\`

Forneça uma análise completa incluindo:

1. **Assinatura**: Explicação dos parâmetros e tipo de retorno
2. **Funcionamento**: Como a função opera internamente
3. **Casos de uso**: Quando e como usar esta função
4. **Efeitos colaterais**: Modificações de estado ou side effects
5. **Tratamento de erros**: Como erros são tratados
6. **Performance**: Considerações de performance
7. **Testabilidade**: Como testar esta função
8. **Refatoração**: Possíveis melhorias

Use exemplos práticos quando relevante.`;

        const response = await this.backendService.askQuestion(prompt);
        return response || 'Não foi possível gerar explicação para esta função.';
    }

    /**
     * Gera explicação de arquivo
     */
    private async generateFileExplanation(document: vscode.TextDocument): Promise<string> {
        const context = this.contextService.getCurrentContext();
        const fileContent = document.getText();

        const prompt = `
Analise e explique este arquivo de código:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Código do arquivo:
\`\`\`${document.languageId}
${fileContent.substring(0, 3000)}${fileContent.length > 3000 ? '...' : ''}
\`\`\`

Forneça uma análise arquitetural incluindo:

1. **Visão geral**: Propósito e responsabilidade do arquivo
2. **Estrutura**: Organização do código (classes, funções, etc.)
3. **Dependências**: Imports e módulos utilizados
4. **Padrões**: Padrões arquiteturais aplicados
5. **Fluxo de dados**: Como os dados fluem pelo código
6. **Pontos de entrada**: Principais pontos de acesso
7. **Configurações**: Configurações e constantes importantes
8. **Melhorias**: Sugestões de estruturação

Foque nos aspectos arquiteturais e de design.`;

        const response = await this.backendService.askQuestion(prompt);
        return response || 'Não foi possível gerar explicação para este arquivo.';
    }

    /**
     * Obtém código da função na posição do cursor
     */
    private async getFunctionAtCursor(editor: vscode.TextEditor): Promise<string | null> {
        try {
            const position = editor.selection.active;
            const document = editor.document;

            // Buscar por padrões de função baseados na linguagem
            const languageId = document.languageId;
            let functionPattern: RegExp;

            switch (languageId) {
                case 'javascript':
                case 'typescript':
                    functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\bfunction)|\w+\s*\([^)]*\)\s*\{)/;
                    break;
                case 'python':
                    functionPattern = /def\s+\w+\s*\([^)]*\):/;
                    break;
                case 'java':
                case 'csharp':
                    functionPattern = /(?:public|private|protected|static|\w+)\s+\w+\s+\w+\s*\([^)]*\)\s*\{/;
                    break;
                default:
                    functionPattern = /\w+\s*\([^)]*\)\s*\{/;
            }

            // Buscar função ao redor da posição atual
            let startLine = position.line;
            let endLine = position.line;

            // Procurar início da função para trás
            for (let i = position.line; i >= 0; i--) {
                const lineText = document.lineAt(i).text;
                if (functionPattern.test(lineText)) {
                    startLine = i;
                    break;
                }
                if (i < position.line - 20) break; // Limite de busca
            }

            // Procurar fim da função para frente
            let braceCount = 0;
            let foundStart = false;

            for (let i = startLine; i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;

                for (const char of lineText) {
                    if (char === '{') {
                        braceCount++;
                        foundStart = true;
                    } else if (char === '}') {
                        braceCount--;
                        if (foundStart && braceCount === 0) {
                            endLine = i;
                            break;
                        }
                    }
                }

                if (foundStart && braceCount === 0) break;
                if (i > startLine + 50) break; // Limite de busca
            }

            if (startLine < endLine) {
                const range = new vscode.Range(startLine, 0, endLine + 1, 0);
                return document.getText(range);
            }

            return null;

        } catch (error) {
            Logger.error('Error getting function at cursor:', error);
            return null;
        }
    }

    /**
     * Mostra explicação em output channel e webview
     */
    private showExplanation(explanation: string, code: string, language: string): void {
        // Mostrar no output channel
        this.outputChannel.clear();
        this.outputChannel.appendLine('='.repeat(80));
        this.outputChannel.appendLine('EXPLICAÇÃO DE CÓDIGO - xCopilot');
        this.outputChannel.appendLine('='.repeat(80));
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('CÓDIGO ANALISADO:');
        this.outputChannel.appendLine('-'.repeat(40));
        this.outputChannel.appendLine(code.substring(0, 500) + (code.length > 500 ? '...' : ''));
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('EXPLICAÇÃO:');
        this.outputChannel.appendLine('-'.repeat(40));
        this.outputChannel.appendLine(explanation);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('='.repeat(80));

        this.outputChannel.show();

        // Também mostrar notificação
        vscode.window.showInformationMessage(
            'Explicação gerada! Veja no painel "xCopilot - Code Explanation"',
            'Ver Explicação'
        ).then(choice => {
            if (choice === 'Ver Explicação') {
                this.outputChannel.show();
            }
        });
    }

    /**
     * Obtém output channel
     */
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    /**
     * Limpa recursos
     */
    dispose(): void {
        this.outputChannel.dispose();
        Logger.info('Code explanation service disposed');
    }
}
