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

        // New commands for Smart Refactoring Engine
        const extractMethodCommand = vscode.commands.registerCommand(
            'xcopilot.extractMethod',
            (uri?: vscode.Uri, range?: vscode.Range) => this.extractMethod(uri, range)
        );

        const extractClassCommand = vscode.commands.registerCommand(
            'xcopilot.extractClass',
            (uri?: vscode.Uri, range?: vscode.Range) => this.extractClass(uri, range)
        );

        const extractDuplicatedCodeCommand = vscode.commands.registerCommand(
            'xcopilot.extractDuplicatedCode',
            (uri?: vscode.Uri, range?: vscode.Range) => this.extractDuplicatedCode(uri, range)
        );

        const convertToAsyncAwaitCommand = vscode.commands.registerCommand(
            'xcopilot.convertToAsyncAwait',
            (lineNumber?: number) => this.convertToAsyncAwait(lineNumber)
        );

        const convertToArrowFunctionCommand = vscode.commands.registerCommand(
            'xcopilot.convertToArrowFunction',
            (lineNumber?: number) => this.convertToArrowFunction(lineNumber)
        );

        const applyDestructuringCommand = vscode.commands.registerCommand(
            'xcopilot.applyDestructuring',
            (lineNumber?: number) => this.applyDestructuring(lineNumber)
        );

        const moveMethodCommand = vscode.commands.registerCommand(
            'xcopilot.moveMethod',
            () => this.moveMethod()
        );

        const refactorWorkspaceCommand = vscode.commands.registerCommand(
            'xcopilot.refactorWorkspace',
            () => this.refactorWorkspace()
        );

        context.subscriptions.push(
            refactorCommand,
            extractFunctionCommand,
            extractVariableCommand,
            optimizeImportsCommand,
            applyPatternCommand,
            extractMethodCommand,
            extractClassCommand,
            extractDuplicatedCodeCommand,
            convertToAsyncAwaitCommand,
            convertToArrowFunctionCommand,
            applyDestructuringCommand,
            moveMethodCommand,
            refactorWorkspaceCommand
        );
    }

    /**
     * Refatora código selecionado
     */
    private async refactorSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Select code to refactor');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const context = this.contextService.getCurrentContext();

            vscode.window.showInformationMessage('🔧 Analyzing code for refactoring...');

            const refactoredCode = await this.generateRefactoredCode(selectedText, context, editor.document.languageId);

            if (refactoredCode && refactoredCode !== selectedText) {
                const choice = await vscode.window.showInformationMessage(
                    'Refactored code generated! Do you want to apply the changes?',
                    'Apply',
                    'Preview',
                    'Cancel'
                );

                if (choice === 'Apply') {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, refactoredCode);
                    });
                    vscode.window.showInformationMessage('✅ Refactoring applied successfully!');
                } else if (choice === 'Preview') {
                    await this.showRefactoringPreview(selectedText, refactoredCode);
                }
            } else {
                vscode.window.showInformationMessage('No refactoring improvements identified');
            }

        } catch (error) {
            Logger.error('Error refactoring code:', error);
            vscode.window.showErrorMessage('Error refactoring code');
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
            vscode.window.showWarningMessage('Select code to extract into function');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const functionName = await vscode.window.showInputBox({
                prompt: 'New function name:',
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

                vscode.window.showInformationMessage(`✅ Function "${functionName}" extracted successfully!`);
            }

        } catch (error) {
            Logger.error('Error extracting function:', error);
            vscode.window.showErrorMessage('Error extracting function');
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
            vscode.window.showWarningMessage('Select the expression to extract into variable');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const variableName = await vscode.window.showInputBox({
                prompt: 'New variable name:',
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
            vscode.window.showErrorMessage('Error extracting variable');
        }
    }

    /**
     * Otimiza imports do arquivo atual
     */
    private async optimizeImports(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            vscode.window.showInformationMessage('🔧 Optimizing imports...');

            const fileContent = editor.document.getText();
            const context = this.contextService.getCurrentContext();

            const optimizedImports = await this.generateOptimizedImports(
                fileContent,
                context,
                editor.document.languageId
            );

            if (optimizedImports && optimizedImports !== fileContent) {
                const choice = await vscode.window.showInformationMessage(
                    'Imports optimized! Apply changes?',
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

                    vscode.window.showInformationMessage('✅ Imports optimized successfully!');
                }
            } else {
                vscode.window.showInformationMessage('Imports are already optimized');
            }

        } catch (error) {
            Logger.error('Error optimizing imports:', error);
            vscode.window.showErrorMessage('Error optimizing imports');
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
            placeHolder: 'Select the design pattern to apply'
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
            vscode.window.showErrorMessage('Error applying design pattern');
        }
    }

    /**
     * Extrai método com suporte a CodeLens
     */
    private async extractMethod(uri?: vscode.Uri, range?: vscode.Range): Promise<void> {
        let editor = vscode.window.activeTextEditor;
        let selection = range;

        // Se URI foi fornecida, abrir o documento
        if (uri) {
            const document = await vscode.workspace.openTextDocument(uri);
            editor = await vscode.window.showTextDocument(document);
        }

        if (!editor) return;

        // Se range foi fornecido, usar como seleção
        if (range) {
            editor.selection = new vscode.Selection(range.start, range.end);
            selection = range;
        } else {
            selection = editor.selection;
        }

        if (!selection || selection.isEmpty) {
            vscode.window.showWarningMessage('Select code to extract into method');
            return;
        }

        await this.extractFunction(); // Reutilizar lógica existente
    }

    /**
     * Extrai classe de função com muitos parâmetros
     */
    private async extractClass(uri?: vscode.Uri, range?: vscode.Range): Promise<void> {
        let editor = vscode.window.activeTextEditor;

        if (uri) {
            const document = await vscode.workspace.openTextDocument(uri);
            editor = await vscode.window.showTextDocument(document);
        }

        if (!editor) return;

        try {
            const selectedText = range ? 
                editor.document.getText(range) : 
                editor.document.getText(editor.selection);

            const className = await vscode.window.showInputBox({
                prompt: 'New class name:',
                value: 'ExtractedClass'
            });

            if (!className) return;

            const context = this.contextService.getCurrentContext();
            const classCode = await this.generateExtractedClass(
                selectedText,
                className,
                context,
                editor.document.languageId
            );

            if (classCode) {
                await this.showExtractClassPreview(selectedText, classCode, className);
            }

        } catch (error) {
            Logger.error('Error extracting class:', error);
            vscode.window.showErrorMessage('Error extracting class');
        }
    }

    /**
     * Extrai código duplicado
     */
    private async extractDuplicatedCode(uri?: vscode.Uri, range?: vscode.Range): Promise<void> {
        let editor = vscode.window.activeTextEditor;

        if (uri) {
            const document = await vscode.workspace.openTextDocument(uri);
            editor = await vscode.window.showTextDocument(document);
        }

        if (!editor) return;

        try {
            const targetLine = range ? range.start.line : editor.selection.start.line;
            const duplicates = await this.findDuplicatedCode(editor.document, targetLine);

            if (duplicates.length < 2) {
                vscode.window.showInformationMessage('Insufficient duplicate code found');
                return;
            }

            const functionName = await vscode.window.showInputBox({
                prompt: 'Function name for extracted code:',
                value: 'extractedFunction'
            });

            if (!functionName) return;

            await this.extractDuplicatesIntoFunction(editor, duplicates, functionName);

        } catch (error) {
            Logger.error('Error extracting duplicated code:', error);
            vscode.window.showErrorMessage('Error extracting duplicated code');
        }
    }

    /**
     * Converte callback para async/await
     */
    private async convertToAsyncAwait(lineNumber?: number): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const line = lineNumber !== undefined ? 
                editor.document.lineAt(lineNumber) : 
                editor.document.lineAt(editor.selection.start.line);

            const convertedCode = await this.generateAsyncAwaitCode(
                line.text,
                this.contextService.getCurrentContext(),
                editor.document.languageId
            );

            if (convertedCode && convertedCode !== line.text) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(line.range, convertedCode);
                });
                vscode.window.showInformationMessage('✅ Converted to async/await!');
            }

        } catch (error) {
            Logger.error('Error converting to async/await:', error);
            vscode.window.showErrorMessage('Error converting to async/await');
        }
    }

    /**
     * Converte para arrow function
     */
    private async convertToArrowFunction(lineNumber?: number): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const line = lineNumber !== undefined ? 
                editor.document.lineAt(lineNumber) : 
                editor.document.lineAt(editor.selection.start.line);

            const convertedCode = await this.generateArrowFunction(
                line.text,
                this.contextService.getCurrentContext(),
                editor.document.languageId
            );

            if (convertedCode && convertedCode !== line.text) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(line.range, convertedCode);
                });
                vscode.window.showInformationMessage('✅ Converted to arrow function!');
            }

        } catch (error) {
            Logger.error('Error converting to arrow function:', error);
            vscode.window.showErrorMessage('Error converting to arrow function');
        }
    }

    /**
     * Aplica destructuring
     */
    private async applyDestructuring(lineNumber?: number): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const line = lineNumber !== undefined ? 
                editor.document.lineAt(lineNumber) : 
                editor.document.lineAt(editor.selection.start.line);

            const destructuredCode = await this.generateDestructuredCode(
                line.text,
                this.contextService.getCurrentContext(),
                editor.document.languageId
            );

            if (destructuredCode && destructuredCode !== line.text) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(line.range, destructuredCode);
                });
                vscode.window.showInformationMessage('✅ Destructuring applied!');
            }

        } catch (error) {
            Logger.error('Error applying destructuring:', error);
            vscode.window.showErrorMessage('Error applying destructuring');
        }
    }

    /**
     * Move método entre classes
     */
    private async moveMethod(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showWarningMessage('Select the method to move');
                return;
            }

            const availableFiles = await this.findAvailableFiles();
            const availableClasses = await this.findAvailableClasses(editor.document);
            
            if (availableClasses.length === 0 && availableFiles.length === 0) {
                vscode.window.showWarningMessage('No target classes found');
                return;
            }

            // Escolher entre classe no mesmo arquivo ou arquivo diferente
            const moveOptions = ['Class in same file', 'Different file'];
            const moveType = await vscode.window.showQuickPick(moveOptions, {
                placeHolder: 'Where do you want to move the method?'
            });

            if (!moveType) return;

            if (moveType === 'Class in same file') {
                await this.moveMethodToSameFile(editor, selection, availableClasses);
            } else {
                await this.moveMethodToOtherFile(editor, selection, availableFiles);
            }

        } catch (error) {
            Logger.error('Error moving method:', error);
            vscode.window.showErrorMessage('Error moving method');
        }
    }

    /**
     * Move método para classe no mesmo arquivo
     */
    private async moveMethodToSameFile(
        editor: vscode.TextEditor,
        selection: vscode.Selection,
        availableClasses: string[]
    ): Promise<void> {
        const targetClass = await vscode.window.showQuickPick(availableClasses, {
            placeHolder: 'Select the target class'
        });

        if (!targetClass) return;

        const selectedMethod = editor.document.getText(selection);
        await this.performMethodMove(editor, selection, selectedMethod, targetClass);
    }

    /**
     * Move método para arquivo diferente
     */
    private async moveMethodToOtherFile(
        editor: vscode.TextEditor,
        selection: vscode.Selection,
        availableFiles: vscode.Uri[]
    ): Promise<void> {
        const fileQuickPicks = availableFiles.map(uri => ({
            label: vscode.workspace.asRelativePath(uri),
            uri: uri
        }));

        const selectedFile = await vscode.window.showQuickPick(fileQuickPicks, {
            placeHolder: 'Select the target file'
        });

        if (!selectedFile) return;

        // Abrir arquivo de destino e encontrar classes
        const targetDocument = await vscode.workspace.openTextDocument(selectedFile.uri);
        const targetClasses = await this.findAvailableClasses(targetDocument);

        if (targetClasses.length === 0) {
            vscode.window.showWarningMessage('No classes found in target file');
            return;
        }

        const targetClass = await vscode.window.showQuickPick(targetClasses, {
            placeHolder: 'Select the target class'
        });

        if (!targetClass) return;

        await this.performMultiFileMethodMove(editor, selection, targetDocument, targetClass);
    }

    /**
     * Executa movimentação de método entre arquivos
     */
    private async performMultiFileMethodMove(
        sourceEditor: vscode.TextEditor,
        methodRange: vscode.Selection,
        targetDocument: vscode.TextDocument,
        targetClass: string
    ): Promise<void> {
        const methodCode = sourceEditor.document.getText(methodRange);

        const choice = await vscode.window.showInformationMessage(
            `Move method to class "${targetClass}" in file "${vscode.workspace.asRelativePath(targetDocument.uri)}"?`,
            'Move',
            'Cancel'
        );

        if (choice !== 'Move') return;

        // Open target file editor
        const targetEditor = await vscode.window.showTextDocument(targetDocument);

        // Adicionar método ao arquivo de destino
        const classPosition = this.findClassPosition(targetDocument, targetClass);
        if (classPosition) {
            await targetEditor.edit(editBuilder => {
                editBuilder.insert(classPosition, `\n    ${methodCode}\n`);
            });
        }

        // Remover método do arquivo origem
        await sourceEditor.edit(editBuilder => {
            editBuilder.delete(methodRange);
        });

        vscode.window.showInformationMessage(`✅ Method moved to "${targetClass}" in ${vscode.workspace.asRelativePath(targetDocument.uri)}!`);
    }

    /**
     * Refatora workspace inteiro
     */
    private async refactorWorkspace(): Promise<void> {
        try {
            // Encontrar arquivos de código no workspace
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,cs,cpp,c,php,rb,go,rs}',
                '**/node_modules/**'
            );

            if (files.length === 0) {
                vscode.window.showInformationMessage('No code files found in workspace');
                return;
            }

            const choice = await vscode.window.showInformationMessage(
                `Found ${files.length} code file(s). Do you want to proceed with workspace refactoring?`,
                'Proceed',
                'Cancel'
            );

            if (choice !== 'Proceed') return;

            // Choose refactoring types
            const refactoringTypes = [
                'Optimize Imports',
                'Convert to ES6+',
                'Apply Design Patterns',
                'Extract Duplicate Code',
                'All Options'
            ];

            const selectedTypes = await vscode.window.showQuickPick(refactoringTypes, {
                placeHolder: 'Select refactoring types',
                canPickMany: true
            });

            if (!selectedTypes || selectedTypes.length === 0) return;

            vscode.window.showInformationMessage('🔧 Starting workspace refactoring...');

            const results = await this.processWorkspaceFiles(files, selectedTypes);

            // Show results report
            await this.showWorkspaceRefactoringReport(results);

        } catch (error) {
            Logger.error('Error refactoring workspace:', error);
            vscode.window.showErrorMessage('Error refactoring workspace');
        }
    }

    /**
     * Processa arquivos do workspace para refatoração
     */
    private async processWorkspaceFiles(
        files: vscode.Uri[],
        refactoringTypes: string[]
    ): Promise<{ file: string; changes: string[]; errors: string[] }[]> {
        const results: { file: string; changes: string[]; errors: string[] }[] = [];

        for (const fileUri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileResults = await this.processFileForRefactoring(document, refactoringTypes);
                
                results.push({
                    file: vscode.workspace.asRelativePath(fileUri),
                    changes: fileResults.changes,
                    errors: fileResults.errors
                });

                // Atualizar progresso
                vscode.window.showInformationMessage(
                    `Processing: ${vscode.workspace.asRelativePath(fileUri)}`
                );

            } catch (error) {
                results.push({
                    file: vscode.workspace.asRelativePath(fileUri),
                    changes: [],
                    errors: [`Erro ao processar arquivo: ${error}`]
                });
            }
        }

        return results;
    }

    /**
     * Processa arquivo individual para refatoração
     */
    private async processFileForRefactoring(
        document: vscode.TextDocument,
        refactoringTypes: string[]
    ): Promise<{ changes: string[]; errors: string[] }> {
        const changes: string[] = [];
        const errors: string[] = [];

        try {
            const content = document.getText();
            let modifiedContent = content;

            for (const refactoringType of refactoringTypes) {
                try {
                    switch (refactoringType) {
                        case 'Optimize Imports':
                        case 'All Options':
                            const optimizedImports = await this.generateOptimizedImports(
                                modifiedContent,
                                {},
                                document.languageId
                            );
                            if (optimizedImports !== modifiedContent) {
                                modifiedContent = optimizedImports;
                                changes.push('Imports optimized');
                            }
                            break;

                        case 'Convert to ES6+':
                            const modernizedCode = await this.modernizeCodeForFile(
                                modifiedContent,
                                document.languageId
                            );
                            if (modernizedCode !== modifiedContent) {
                                modifiedContent = modernizedCode;
                                changes.push('Code modernized to ES6+');
                            }
                            break;

                        case 'Extract Duplicate Code':
                            const deduplicatedCode = await this.extractDuplicatesInFile(
                                modifiedContent,
                                document
                            );
                            if (deduplicatedCode !== modifiedContent) {
                                modifiedContent = deduplicatedCode;
                                changes.push('Duplicate code extracted');
                            }
                            break;
                    }
                } catch (error) {
                    errors.push(`Erro em ${refactoringType}: ${error}`);
                }
            }

            // Aplicar mudanças se houver
            if (modifiedContent !== content && changes.length > 0) {
                const editor = await vscode.window.showTextDocument(document);
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(content.length)
                );

                await editor.edit(editBuilder => {
                    editBuilder.replace(fullRange, modifiedContent);
                });
            }

        } catch (error) {
            errors.push(`Erro geral: ${error}`);
        }

        return { changes, errors };
    }

    /**
     * Moderniza código para ES6+
     */
    private async modernizeCodeForFile(content: string, language: string): Promise<string> {
        if (language !== 'javascript' && language !== 'typescript') {
            return content;
        }

        const prompt = `
Modernize o seguinte código ${language} para ES6+:

\`\`\`${language}
${content}
\`\`\`

Aplique:
- Arrow functions onde apropriado
- const/let ao invés de var
- Template literals
- Destructuring
- Async/await ao invés de callbacks
- Spread operator
- Classes ao invés de function constructors

Retorne APENAS o código modernizado:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Extrai duplicatas em arquivo
     */
    private async extractDuplicatesInFile(content: string, document: vscode.TextDocument): Promise<string> {
        // Implementação simplificada - na prática seria mais complexa
        return content; // Por agora, retornar sem mudanças
    }

    /**
     * Mostra relatório de refatoração do workspace
     */
    private async showWorkspaceRefactoringReport(
        results: { file: string; changes: string[]; errors: string[] }[]
    ): Promise<void> {
        const totalFiles = results.length;
        const filesWithChanges = results.filter(r => r.changes.length > 0).length;
        const filesWithErrors = results.filter(r => r.errors.length > 0).length;

        let report = `# Workspace Refactoring Report\n\n`;
        report += `**Files processed**: ${totalFiles}\n`;
        report += `**Files modified**: ${filesWithChanges}\n`;
        report += `**Files with errors**: ${filesWithErrors}\n\n`;

        report += `## Details by File\n\n`;

        for (const result of results) {
            report += `### ${result.file}\n`;
            
            if (result.changes.length > 0) {
                report += `**Changes applied**:\n`;
                for (const change of result.changes) {
                    report += `- ✅ ${change}\n`;
                }
            }

            if (result.errors.length > 0) {
                report += `**Errors found**:\n`;
                for (const error of result.errors) {
                    report += `- ❌ ${error}\n`;
                }
            }

            if (result.changes.length === 0 && result.errors.length === 0) {
                report += `- ℹ️ No changes needed\n`;
            }

            report += `\n`;
        }

        // Criar documento com o relatório
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(
            `✅ Workspace refactoring completed! ${filesWithChanges}/${totalFiles} files modified.`
        );
    }
    private async findAvailableFiles(): Promise<vscode.Uri[]> {
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,js,py,java,cs,cpp,c,php,rb,go,rs}',
            '**/node_modules/**'
        );
        
        // Excluir arquivo atual
        const currentFile = vscode.window.activeTextEditor?.document.uri;
        return files.filter(file => !currentFile || file.fsPath !== currentFile.fsPath);
    }
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
        await this.showEnhancedDiffPreview(original, refactored, 'Refatoração');
    }

    /**
     * Mostra preview aprimorado com diff view
     */
    private async showEnhancedDiffPreview(
        original: string,
        modified: string,
        title: string
    ): Promise<void> {
        // Criar documentos temporários para diff
        const originalDoc = await vscode.workspace.openTextDocument({
            content: original,
            language: 'typescript'
        });

        const modifiedDoc = await vscode.workspace.openTextDocument({
            content: modified,
            language: 'typescript'
        });

        // Mostrar diff view
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            modifiedDoc.uri,
            `${title}: Original ↔ Modificado`,
            { preserveFocus: true }
        );

        // Mostrar opções de ação
        const choice = await vscode.window.showInformationMessage(
            `${title} gerada! O que deseja fazer?`,
            'Aplicar',
            'Salvar como Arquivo',
            'Fechar'
        );

        if (choice === 'Aplicar') {
            await this.applyRefactoringChanges(original, modified);
        } else if (choice === 'Salvar como Arquivo') {
            await this.saveRefactoringAsFile(modified, title);
        }
    }

    /**
     * Aplica mudanças de refatoração
     */
    private async applyRefactoringChanges(original: string, modified: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const content = document.getText();

        // Encontrar e substituir o texto original
        const originalIndex = content.indexOf(original);
        if (originalIndex !== -1) {
            const startPos = document.positionAt(originalIndex);
            const endPos = document.positionAt(originalIndex + original.length);
            const range = new vscode.Range(startPos, endPos);

            await editor.edit(editBuilder => {
                editBuilder.replace(range, modified);
            });

            vscode.window.showInformationMessage('✅ Refatoração aplicada com sucesso!');
        } else {
            vscode.window.showWarningMessage('Unable to apply refactoring automatically');
        }
    }

    /**
     * Salva refatoração como arquivo
     */
    private async saveRefactoringAsFile(content: string, title: string): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${title}-${timestamp}.txt`;
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(filename),
            filters: {
                'Text Files': ['txt'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`📁 Refatoração salva em ${uri.fsPath}`);
        }
    }

    /**
     * Mostra preview do padrão aplicado
     */
    private async showPatternPreview(original: string, pattern: string, patternName: string): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            `Pattern ${patternName} generated! Do you want to view it?`,
            'View',
            'Cancel'
        );

        if (choice === 'View') {
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

    /**
     * Gera classe extraída
     */
    private async generateExtractedClass(
        code: string,
        className: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Extraia o seguinte código ${language} em uma classe chamada "${className}":

Código a extrair:
\`\`\`${language}
${code}
\`\`\`

Crie uma classe bem estruturada com:
- Propriedades privadas apropriadas
- Construtor com parâmetros necessários
- Métodos públicos bem organizados
- Aplicação de princípios SOLID

Retorne APENAS o código da classe:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Encontra código duplicado
     */
    private async findDuplicatedCode(document: vscode.TextDocument, targetLine: number): Promise<vscode.Range[]> {
        const lines = document.getText().split('\n');
        const targetCode = lines[targetLine].trim();
        const duplicates: vscode.Range[] = [];

        if (targetCode.length < 20) return duplicates;

        for (let i = 0; i < lines.length; i++) {
            if (i !== targetLine && lines[i].trim() === targetCode) {
                duplicates.push(new vscode.Range(i, 0, i, lines[i].length));
            }
        }

        return duplicates;
    }

    /**
     * Extrai duplicatas em função
     */
    private async extractDuplicatesIntoFunction(
        editor: vscode.TextEditor,
        duplicates: vscode.Range[],
        functionName: string
    ): Promise<void> {
        const firstLine = editor.document.getText(duplicates[0]);
        const context = this.contextService.getCurrentContext();
        
        const extraction = await this.generateFunctionExtraction(
            firstLine,
            functionName,
            context,
            editor.document.languageId
        );

        if (!extraction) return;

        await editor.edit(editBuilder => {
            // Substituir todas as duplicatas pela chamada da função
            for (const duplicate of duplicates) {
                editBuilder.replace(duplicate, extraction.functionCall);
            }

            // Inserir definição da função
            const insertPosition = this.findBestInsertionPoint(editor.document);
            editBuilder.insert(insertPosition, `\n${extraction.functionDefinition}\n`);
        });

        vscode.window.showInformationMessage(`✅ ${duplicates.length} duplicates extracted to "${functionName}"!`);
    }

    /**
     * Gera código async/await
     */
    private async generateAsyncAwaitCode(
        code: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Converta o seguinte código ${language} de callbacks/promises para async/await:

Código original:
\`\`\`${language}
${code}
\`\`\`

Aplique as melhores práticas:
- Use async/await ao invés de .then()/.catch()
- Adicione try/catch para tratamento de erros
- Mantenha a funcionalidade original

Retorne APENAS o código convertido:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Gera arrow function
     */
    private async generateArrowFunction(
        code: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Converta a seguinte função ${language} para arrow function:

Código original:
\`\`\`${language}
${code}
\`\`\`

Mantenha:
- Funcionalidade original
- Parâmetros e tipos
- Escopo correto

Retorne APENAS o código convertido:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Gera código com destructuring
     */
    private async generateDestructuredCode(
        code: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Aplique destructuring ao seguinte código ${language}:

Código original:
\`\`\`${language}
${code}
\`\`\`

Substitua acessos repetidos a propriedades por destructuring:
- Object destructuring para propriedades
- Array destructuring quando apropriado
- Mantenha funcionalidade original

Retorne APENAS o código com destructuring aplicado:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Encontra classes disponíveis no documento
     */
    private async findAvailableClasses(document: vscode.TextDocument): Promise<string[]> {
        const content = document.getText();
        const classRegex = /class\s+(\w+)/g;
        const classes: string[] = [];
        
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            classes.push(match[1]);
        }

        return classes;
    }

    /**
     * Executa a movimentação de método
     */
    private async performMethodMove(
        editor: vscode.TextEditor,
        methodRange: vscode.Selection,
        methodCode: string,
        targetClass: string
    ): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            `Move method to class "${targetClass}"?`,
            'Move',
            'Cancel'
        );

        if (choice !== 'Move') return;

        // Remover método da posição original
        await editor.edit(editBuilder => {
            editBuilder.delete(methodRange);
        });

        // Encontrar posição da classe de destino e inserir método
        const classPosition = this.findClassPosition(editor.document, targetClass);
        if (classPosition) {
            await editor.edit(editBuilder => {
                editBuilder.insert(classPosition, `\n    ${methodCode}\n`);
            });
        }

        vscode.window.showInformationMessage(`✅ Method moved to "${targetClass}"!`);
    }

    /**
     * Encontra posição de uma classe
     */
    private findClassPosition(document: vscode.TextDocument, className: string): vscode.Position | null {
        const content = document.getText();
        const classRegex = new RegExp(`class\\s+${className}\\s*{`, 'g');
        const match = classRegex.exec(content);
        
        if (!match) return null;

        // Encontrar a última chave antes do fechamento da classe
        const classStart = match.index + match[0].length;
        let braceCount = 1;
        let insertPosition = classStart;

        for (let i = classStart; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    insertPosition = i;
                    break;
                }
            }
        }

        return document.positionAt(insertPosition);
    }

    /**
     * Mostra preview da classe extraída
     */
    private async showExtractClassPreview(original: string, extracted: string, className: string): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            `Class "${className}" generated! Do you want to view it?`,
            'Apply',
            'View',
            'Cancel'
        );

        if (choice === 'View') {
            const doc = await vscode.workspace.openTextDocument({
                content: `// EXTRACTED CLASS: ${className}\n\n${extracted}`,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
        } else if (choice === 'Apply') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const insertPosition = this.findBestInsertionPoint(editor.document);
                await editor.edit(editBuilder => {
                    editBuilder.insert(insertPosition, `\n${extracted}\n`);
                });
                vscode.window.showInformationMessage(`✅ Class "${className}" created!`);
            }
        }
    }
}
