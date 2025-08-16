import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';

/**
 * Serviço para refatoração automática de código
 */
export class RefactoringService {
    private static instance: RefactoringService;
    private backendService: BackendService;
    private contextService: CodeContextService;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
    }

    static getInstance(): RefactoringService {
        if (!RefactoringService.instance) {
            RefactoringService.instance = new RefactoringService();
        }
        return RefactoringService.instance;
    }

    /**
     * Registra os command handlers para refatoração
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Comando para refatorar código selecionado
        const refactorCommand = vscode.commands.registerCommand(
            'xcopilot.refactorCode',
            () => this.refactorSelectedCode()
        );

        // Comando para extrair função
        const extractFunctionCommand = vscode.commands.registerCommand(
            'xcopilot.extractFunction',
            () => this.extractFunction()
        );

        // Comando para extrair variável
        const extractVariableCommand = vscode.commands.registerCommand(
            'xcopilot.extractVariable',
            () => this.extractVariable()
        );

        // Comando para otimizar imports
        const optimizeImportsCommand = vscode.commands.registerCommand(
            'xcopilot.optimizeImports',
            () => this.optimizeImports()
        );

        // Comando para aplicar padrões de design
        const applyPatternCommand = vscode.commands.registerCommand(
            'xcopilot.applyDesignPattern',
            () => this.applyDesignPattern()
        );

        context.subscriptions.push(
            refactorCommand,
            extractFunctionCommand,
            extractVariableCommand,
            optimizeImportsCommand,
            applyPatternCommand
        );
    }

    /**
     * Refatora código selecionado
     */
    private async refactorSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione o código para refatorar');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const context = this.contextService.getCurrentContext();

            vscode.window.showInformationMessage('🔧 Analisando código para refatoração...');

            const refactoredCode = await this.generateRefactoredCode(selectedText, context, editor.document.languageId);

            if (refactoredCode && refactoredCode !== selectedText) {
                const choice = await vscode.window.showInformationMessage(
                    'Código refatorado gerado! Deseja aplicar as mudanças?',
                    'Aplicar',
                    'Visualizar',
                    'Cancelar'
                );

                if (choice === 'Aplicar') {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, refactoredCode);
                    });
                    vscode.window.showInformationMessage('✅ Refatoração aplicada com sucesso!');
                } else if (choice === 'Visualizar') {
                    await this.showRefactoringPreview(selectedText, refactoredCode);
                }
            } else {
                vscode.window.showInformationMessage('Nenhuma melhoria de refatoração foi identificada');
            }

        } catch (error) {
            Logger.error('Error refactoring code:', error);
            vscode.window.showErrorMessage('Erro ao refatorar código');
        }
    }

    /**
     * Extrai função do código selecionado
     */
    private async extractFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione o código para extrair em função');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const functionName = await vscode.window.showInputBox({
                prompt: 'Nome da nova função:',
                value: 'extractedFunction'
            });

            if (!functionName) return;

            const context = this.contextService.getCurrentContext();
            const extraction = await this.generateFunctionExtraction(
                selectedText,
                functionName,
                context,
                editor.document.languageId
            );

            if (extraction) {
                await editor.edit(editBuilder => {
                    // Substituir código selecionado pela chamada da função
                    editBuilder.replace(selection, extraction.functionCall);

                    // Inserir definição da função
                    const insertPosition = this.findBestInsertionPoint(editor.document);
                    editBuilder.insert(insertPosition, `\n${extraction.functionDefinition}\n`);
                });

                vscode.window.showInformationMessage(`✅ Função "${functionName}" extraída com sucesso!`);
            }

        } catch (error) {
            Logger.error('Error extracting function:', error);
            vscode.window.showErrorMessage('Erro ao extrair função');
        }
    }

    /**
     * Extrai variável do código selecionado
     */
    private async extractVariable(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione a expressão para extrair em variável');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const variableName = await vscode.window.showInputBox({
                prompt: 'Nome da nova variável:',
                value: 'extractedVariable'
            });

            if (!variableName) return;

            const context = this.contextService.getCurrentContext();
            const extraction = await this.generateVariableExtraction(
                selectedText,
                variableName,
                context,
                editor.document.languageId
            );

            if (extraction) {
                await editor.edit(editBuilder => {
                    // Inserir declaração da variável
                    const lineStart = editor.document.lineAt(selection.start.line).range.start;
                    editBuilder.insert(lineStart, `${extraction.variableDeclaration}\n`);

                    // Substituir expressão selecionada pelo nome da variável
                    editBuilder.replace(selection, variableName);
                });

                vscode.window.showInformationMessage(`✅ Variável "${variableName}" extraída com sucesso!`);
            }

        } catch (error) {
            Logger.error('Error extracting variable:', error);
            vscode.window.showErrorMessage('Erro ao extrair variável');
        }
    }

    /**
     * Otimiza imports do arquivo atual
     */
    private async optimizeImports(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            vscode.window.showInformationMessage('🔧 Otimizando imports...');

            const fileContent = editor.document.getText();
            const context = this.contextService.getCurrentContext();

            const optimizedImports = await this.generateOptimizedImports(
                fileContent,
                context,
                editor.document.languageId
            );

            if (optimizedImports && optimizedImports !== fileContent) {
                const choice = await vscode.window.showInformationMessage(
                    'Imports otimizados! Aplicar mudanças?',
                    'Aplicar',
                    'Cancelar'
                );

                if (choice === 'Aplicar') {
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(fileContent.length)
                    );

                    await editor.edit(editBuilder => {
                        editBuilder.replace(fullRange, optimizedImports);
                    });

                    vscode.window.showInformationMessage('✅ Imports otimizados com sucesso!');
                }
            } else {
                vscode.window.showInformationMessage('Imports já estão otimizados');
            }

        } catch (error) {
            Logger.error('Error optimizing imports:', error);
            vscode.window.showErrorMessage('Erro ao otimizar imports');
        }
    }

    /**
     * Aplica padrão de design ao código
     */
    private async applyDesignPattern(): Promise<void> {
        const patterns = [
            'Singleton',
            'Factory',
            'Observer',
            'Strategy',
            'Command',
            'Adapter',
            'Decorator'
        ];

        const pattern = await vscode.window.showQuickPick(patterns, {
            placeHolder: 'Selecione o padrão de design a aplicar'
        });

        if (!pattern) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const selection = editor.selection;
            const selectedText = selection.isEmpty ?
                editor.document.getText() :
                editor.document.getText(selection);

            const context = this.contextService.getCurrentContext();

            vscode.window.showInformationMessage(`🔧 Aplicando padrão ${pattern}...`);

            const patternCode = await this.generateDesignPattern(
                selectedText,
                pattern,
                context,
                editor.document.languageId
            );

            if (patternCode) {
                await this.showPatternPreview(selectedText, patternCode, pattern);
            }

        } catch (error) {
            Logger.error('Error applying design pattern:', error);
            vscode.window.showErrorMessage('Erro ao aplicar padrão de design');
        }
    }

    /**
     * Gera código refatorado
     */
    private async generateRefactoredCode(
        code: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Refatore o seguinte código ${language} para melhorar:
- Legibilidade
- Performance
- Manutenibilidade
- Aplicação de boas práticas

Código original:
\`\`\`${language}
${code}
\`\`\`

Contexto do arquivo:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Tipo: ${context?.fileType || 'desconhecido'}

Retorne APENAS o código refatorado, sem explicações:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Gera extração de função
     */
    private async generateFunctionExtraction(
        code: string,
        functionName: string,
        context: any,
        language: string
    ): Promise<{ functionDefinition: string; functionCall: string } | null> {
        const prompt = `
Extraia o código a seguir em uma função chamada "${functionName}" em ${language}:

Código a extrair:
\`\`\`${language}
${code}
\`\`\`

Retorne em formato JSON:
{
  "functionDefinition": "definição completa da função",
  "functionCall": "chamada da função para substituir o código original"
}
`;

        const response = await this.backendService.askQuestion(prompt);
        try {
            return JSON.parse(response);
        } catch {
            return null;
        }
    }

    /**
     * Gera extração de variável
     */
    private async generateVariableExtraction(
        expression: string,
        variableName: string,
        context: any,
        language: string
    ): Promise<{ variableDeclaration: string } | null> {
        const prompt = `
Extraia a expressão a seguir em uma variável chamada "${variableName}" em ${language}:

Expressão:
${expression}

Retorne em formato JSON:
{
  "variableDeclaration": "declaração da variável com tipo apropriado"
}
`;

        const response = await this.backendService.askQuestion(prompt);
        try {
            return JSON.parse(response);
        } catch {
            return null;
        }
    }

    /**
     * Gera imports otimizados
     */
    private async generateOptimizedImports(
        fileContent: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Otimize os imports do seguinte arquivo ${language}:
- Remova imports não utilizados
- Organize imports em ordem alfabética
- Agrupe imports por tipo (biblioteca, relativos, etc.)
- Aplique convenções da linguagem

Código completo:
\`\`\`${language}
${fileContent}
\`\`\`

Retorne APENAS o código com imports otimizados:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Gera código com padrão de design aplicado
     */
    private async generateDesignPattern(
        code: string,
        pattern: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Aplique o padrão de design "${pattern}" ao seguinte código ${language}:

Código original:
\`\`\`${language}
${code}
\`\`\`

Implemente o padrão ${pattern} seguindo as melhores práticas.
Retorne APENAS o código refatorado com o padrão aplicado:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Mostra preview da refatoração
     */
    private async showRefactoringPreview(original: string, refactored: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `// ORIGINAL:\n${original}\n\n// REFATORADO:\n${refactored}`,
            language: 'typescript'
        });

        await vscode.window.showTextDocument(doc);
    }

    /**
     * Mostra preview do padrão aplicado
     */
    private async showPatternPreview(original: string, pattern: string, patternName: string): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            `Padrão ${patternName} gerado! Deseja visualizar?`,
            'Visualizar',
            'Cancelar'
        );

        if (choice === 'Visualizar') {
            const doc = await vscode.workspace.openTextDocument({
                content: `// PADRÃO ${patternName.toUpperCase()} APLICADO:\n\n${pattern}`,
                language: 'typescript'
            });

            await vscode.window.showTextDocument(doc);
        }
    }

    /**
     * Encontra o melhor ponto para inserção de funções
     */
    private findBestInsertionPoint(document: vscode.TextDocument): vscode.Position {
        // Por simplicidade, insere no final do arquivo
        return document.positionAt(document.getText().length);
    }

    /**
     * Extrai código limpo da resposta da IA
     */
    private extractCodeFromResponse(response: string): string {
        // Remove markdown code blocks se presentes
        const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)\n?```/;
        const match = response.match(codeBlockRegex);

        if (match) {
            return match[1].trim();
        }

        return response.trim();
    }
}
