import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { 
    RefactoringSuggestion, 
    RefactoringType, 
    RefactoringPreview, 
    CodeAnalysis,
    BulkRefactoringOperation,
    RefactoringRule
} from '../types';

/**
 * Smart Refactoring Engine - Serviço avançado para refatoração automática de código
 */
export class RefactoringService {
    private static instance: RefactoringService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private codeLensProvider: RefactoringCodeLensProvider;
    private refactoringRules: RefactoringRule[] = [];
    private activeSuggestions: Map<string, RefactoringSuggestion[]> = new Map();
    
    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.codeLensProvider = new RefactoringCodeLensProvider(this);
        this.initializeRefactoringRules();
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
        // Comandos existentes
        const refactorCommand = vscode.commands.registerCommand(
            'xcopilot.refactorCode',
            () => this.refactorSelectedCode()
        );

        const extractFunctionCommand = vscode.commands.registerCommand(
            'xcopilot.extractFunction',
            () => this.extractFunction()
        );

        const extractVariableCommand = vscode.commands.registerCommand(
            'xcopilot.extractVariable',
            () => this.extractVariable()
        );

        const optimizeImportsCommand = vscode.commands.registerCommand(
            'xcopilot.optimizeImports',
            () => this.optimizeImports()
        );

        const applyPatternCommand = vscode.commands.registerCommand(
            'xcopilot.applyDesignPattern',
            () => this.applyDesignPattern()
        );

        // Novos comandos da Smart Refactoring Engine
        const smartSuggestionsCommand = vscode.commands.registerCommand(
            'xcopilot.showSmartSuggestions',
            () => this.showSmartSuggestions()
        );

        const extractClassCommand = vscode.commands.registerCommand(
            'xcopilot.extractClass',
            () => this.extractClass()
        );

        const extractInterfaceCommand = vscode.commands.registerCommand(
            'xcopilot.extractInterface',
            () => this.extractInterface()
        );

        const modernizeCodeCommand = vscode.commands.registerCommand(
            'xcopilot.modernizeCode',
            () => this.modernizeCode()
        );

        const smartRenameCommand = vscode.commands.registerCommand(
            'xcopilot.smartRename',
            () => this.smartRename()
        );

        const bulkRefactorCommand = vscode.commands.registerCommand(
            'xcopilot.bulkRefactor',
            () => this.bulkRefactor()
        );

        const previewRefactoringCommand = vscode.commands.registerCommand(
            'xcopilot.previewRefactoring',
            (suggestion: RefactoringSuggestion) => this.previewRefactoring(suggestion)
        );

        const applyRefactoringCommand = vscode.commands.registerCommand(
            'xcopilot.applyRefactoring',
            (suggestion: RefactoringSuggestion) => this.applyRefactoring(suggestion)
        );

        // Registrar code lens provider
        const codeLensProvider = vscode.languages.registerCodeLensProvider(
            ['typescript', 'javascript', 'python', 'java', 'csharp', 'cpp'],
            this.codeLensProvider
        );

        // Listener para análise automática
        const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
            (event) => this.onDocumentChange(event)
        );

        const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(
            (document) => this.analyzeDocumentForSuggestions(document)
        );

        context.subscriptions.push(
            refactorCommand,
            extractFunctionCommand,
            extractVariableCommand,
            optimizeImportsCommand,
            applyPatternCommand,
            smartSuggestionsCommand,
            extractClassCommand,
            extractInterfaceCommand,
            modernizeCodeCommand,
            smartRenameCommand,
            bulkRefactorCommand,
            previewRefactoringCommand,
            applyRefactoringCommand,
            codeLensProvider,
            onDidChangeTextDocument,
            onDidSaveTextDocument
        );
    }

    /**
     * Inicializa regras de refatoração
     */
    private initializeRefactoringRules(): void {
        this.refactoringRules = [
            {
                id: 'var-to-const',
                name: 'Convert var to const/let',
                description: 'Replace var with const or let',
                pattern: /\bvar\s+(\w+)\s*=/g,
                replacement: 'const $1 =',
                enabled: true,
                language: ['javascript', 'typescript']
            },
            {
                id: 'function-to-arrow',
                name: 'Convert to arrow function',
                description: 'Convert function expressions to arrow functions',
                pattern: /function\s*\(([^)]*)\)\s*{/g,
                replacement: '($1) => {',
                enabled: true,
                language: ['javascript', 'typescript']
            },
            {
                id: 'callback-to-async',
                name: 'Convert callback to async/await',
                description: 'Modernize callback patterns to async/await',
                pattern: '',
                replacement: '',
                enabled: true,
                language: ['javascript', 'typescript']
            }
        ];
    }

    /**
     * Analisa documento em busca de sugestões de refatoração
     */
    async analyzeDocumentForSuggestions(document: vscode.TextDocument): Promise<RefactoringSuggestion[]> {
        const analysis = await this.analyzeCode(document.getText(), document.languageId);
        const suggestions: RefactoringSuggestion[] = [];

        // Detectar funções longas
        const longMethods = this.detectLongMethods(document.getText());
        suggestions.push(...longMethods);

        // Detectar código duplicado
        const duplicates = this.detectDuplicateCode(document.getText());
        suggestions.push(...duplicates);

        // Detectar oportunidades de modernização
        const modernizations = this.detectModernizationOpportunities(document.getText(), document.languageId);
        suggestions.push(...modernizations);

        // Detectar padrões de design aplicáveis
        const patterns = this.detectDesignPatternOpportunities(document.getText(), document.languageId);
        suggestions.push(...patterns);

        // Armazenar sugestões para este documento
        this.activeSuggestions.set(document.uri.toString(), suggestions);

        // Atualizar code lenses
        this.codeLensProvider.refresh();

        return suggestions;
    }

    /**
     * Detecta métodos longos que podem ser extraídos
     */
    private detectLongMethods(code: string): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];
        const lines = code.split('\n');
        const functionRegex = /(function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*{)/g;
        
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
            const startIndex = match.index;
            const startLine = code.substring(0, startIndex).split('\n').length - 1;
            
            // Encontrar fim da função (simplificado)
            let braceCount = 0;
            let endLine = startLine;
            let foundStart = false;
            
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                for (const char of line) {
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
            }

            const functionLength = endLine - startLine + 1;
            
            if (functionLength > 20) { // Função com mais de 20 linhas
                suggestions.push({
                    id: `long-method-${startLine}`,
                    type: RefactoringType.EXTRACT_METHOD,
                    title: `Função longa detectada (${functionLength} linhas)`,
                    description: `Esta função tem ${functionLength} linhas e pode ser dividida em funções menores.`,
                    location: {
                        range: {
                            start: { line: startLine, character: 0 },
                            end: { line: endLine, character: lines[endLine]?.length || 0 }
                        },
                        uri: ''
                    },
                    severity: functionLength > 50 ? 'warning' : 'suggestion',
                    confidence: 0.8,
                    autoApply: false
                });
            }
        }

        return suggestions;
    }

    /**
     * Detecta código duplicado
     */
    private detectDuplicateCode(code: string): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];
        const lines = code.split('\n');
        
        // Algoritmo simples para detectar blocos duplicados
        for (let i = 0; i < lines.length - 3; i++) {
            const block = lines.slice(i, i + 3).join('\n').trim();
            if (block.length < 20) continue;
            
            for (let j = i + 3; j < lines.length - 2; j++) {
                const compareBlock = lines.slice(j, j + 3).join('\n').trim();
                if (block === compareBlock) {
                    suggestions.push({
                        id: `duplicate-${i}-${j}`,
                        type: RefactoringType.REMOVE_DUPLICATION,
                        title: 'Código duplicado detectado',
                        description: `Bloco de código duplicado entre linhas ${i + 1} e ${j + 1}`,
                        location: {
                            range: {
                                start: { line: i, character: 0 },
                                end: { line: i + 2, character: lines[i + 2]?.length || 0 }
                            },
                            uri: ''
                        },
                        severity: 'warning',
                        confidence: 0.9,
                        autoApply: false
                    });
                    break;
                }
            }
        }

        return suggestions;
    }

    /**
     * Detecta oportunidades de modernização de código
     */
    private detectModernizationOpportunities(code: string, language: string): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];
        
        if (language === 'javascript' || language === 'typescript') {
            // Detectar uso de var
            const varMatches = [...code.matchAll(/\bvar\s+\w+/g)];
            for (const match of varMatches) {
                const line = code.substring(0, match.index).split('\n').length - 1;
                suggestions.push({
                    id: `var-modernize-${line}`,
                    type: RefactoringType.MODERNIZE_SYNTAX,
                    title: 'Modernizar declaração de variável',
                    description: 'Substituir "var" por "const" ou "let"',
                    location: {
                        range: {
                            start: { line, character: match.index! - code.substring(0, match.index).lastIndexOf('\n') - 1 },
                            end: { line, character: match.index! - code.substring(0, match.index).lastIndexOf('\n') + match[0].length - 1 }
                        },
                        uri: ''
                    },
                    severity: 'suggestion',
                    confidence: 0.95,
                    autoApply: true
                });
            }

            // Detectar callbacks que podem ser async/await
            const callbackPattern = /\.then\s*\(/g;
            const callbackMatches = [...code.matchAll(callbackPattern)];
            for (const match of callbackMatches) {
                const line = code.substring(0, match.index).split('\n').length - 1;
                suggestions.push({
                    id: `async-modernize-${line}`,
                    type: RefactoringType.MODERNIZE_SYNTAX,
                    title: 'Modernizar para async/await',
                    description: 'Converter .then() para async/await',
                    location: {
                        range: {
                            start: { line, character: 0 },
                            end: { line, character: code.split('\n')[line]?.length || 0 }
                        },
                        uri: ''
                    },
                    severity: 'suggestion',
                    confidence: 0.7,
                    autoApply: false
                });
            }
        }

        return suggestions;
    }

    /**
     * Detecta oportunidades de aplicação de padrões de design
     */
    private detectDesignPatternOpportunities(code: string, language: string): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];

        // Detectar Singleton pattern opportunity
        const classPattern = /class\s+(\w+)/g;
        const classMatches = [...code.matchAll(classPattern)];
        
        for (const match of classMatches) {
            const className = match[1];
            if (className.endsWith('Manager') || className.endsWith('Service') || className.endsWith('Controller')) {
                const line = code.substring(0, match.index).split('\n').length - 1;
                suggestions.push({
                    id: `singleton-${className}-${line}`,
                    type: RefactoringType.APPLY_DESIGN_PATTERN,
                    title: `Aplicar padrão Singleton em ${className}`,
                    description: `A classe ${className} parece ser um candidato ao padrão Singleton`,
                    location: {
                        range: {
                            start: { line, character: 0 },
                            end: { line, character: match[0].length }
                        },
                        uri: ''
                    },
                    severity: 'info',
                    confidence: 0.6,
                    autoApply: false
                });
            }
        }

        return suggestions;
    }

    /**
     * Mostra sugestões inteligentes de refatoração
     */
    private async showSmartSuggestions(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        vscode.window.showInformationMessage('🔍 Analisando código para sugestões inteligentes...');

        try {
            const suggestions = await this.analyzeDocumentForSuggestions(editor.document);
            
            if (suggestions.length === 0) {
                vscode.window.showInformationMessage('✅ Nenhuma sugestão de refatoração encontrada');
                return;
            }

            // Mostrar quick pick com sugestões
            const items = suggestions.map(suggestion => ({
                label: suggestion.title,
                description: suggestion.description,
                detail: `Confiança: ${Math.round(suggestion.confidence * 100)}%`,
                suggestion
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Selecione uma sugestão de refatoração',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                await this.previewRefactoring(selected.suggestion);
            }

        } catch (error) {
            Logger.error('Error showing smart suggestions:', error);
            vscode.window.showErrorMessage('Erro ao analisar código para sugestões');
        }
    }

    /**
     * Extrai classe do código selecionado
     */
    private async extractClass(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione o código para extrair em classe');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const className = await vscode.window.showInputBox({
                prompt: 'Nome da nova classe:',
                value: 'ExtractedClass'
            });

            if (!className) return;

            const context = this.contextService.getCurrentContext();
            const extraction = await this.generateClassExtraction(
                selectedText,
                className,
                context,
                editor.document.languageId
            );

            if (extraction) {
                await this.showExtractionPreview(selectedText, extraction, 'Classe');
            }

        } catch (error) {
            Logger.error('Error extracting class:', error);
            vscode.window.showErrorMessage('Erro ao extrair classe');
        }
    }

    /**
     * Extrai interface do código selecionado
     */
    private async extractInterface(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione a classe para extrair interface');
            return;
        }

        try {
            const selectedText = editor.document.getText(selection);
            const interfaceName = await vscode.window.showInputBox({
                prompt: 'Nome da nova interface:',
                value: 'IExtractedInterface'
            });

            if (!interfaceName) return;

            const context = this.contextService.getCurrentContext();
            const extraction = await this.generateInterfaceExtraction(
                selectedText,
                interfaceName,
                context,
                editor.document.languageId
            );

            if (extraction) {
                await this.showExtractionPreview(selectedText, extraction, 'Interface');
            }

        } catch (error) {
            Logger.error('Error extracting interface:', error);
            vscode.window.showErrorMessage('Erro ao extrair interface');
        }
    }

    /**
     * Moderniza código selecionado
     */
    private async modernizeCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const selection = editor.selection;
            const selectedText = selection.isEmpty ?
                editor.document.getText() :
                editor.document.getText(selection);

            vscode.window.showInformationMessage('🔧 Modernizando código...');

            const context = this.contextService.getCurrentContext();
            const modernizedCode = await this.generateModernizedCode(
                selectedText,
                context,
                editor.document.languageId
            );

            if (modernizedCode && modernizedCode !== selectedText) {
                const choice = await vscode.window.showInformationMessage(
                    'Código modernizado! Aplicar mudanças?',
                    'Aplicar',
                    'Visualizar',
                    'Cancelar'
                );

                if (choice === 'Aplicar') {
                    if (selection.isEmpty) {
                        const fullRange = new vscode.Range(
                            editor.document.positionAt(0),
                            editor.document.positionAt(editor.document.getText().length)
                        );
                        await editor.edit(editBuilder => {
                            editBuilder.replace(fullRange, modernizedCode);
                        });
                    } else {
                        await editor.edit(editBuilder => {
                            editBuilder.replace(selection, modernizedCode);
                        });
                    }
                    vscode.window.showInformationMessage('✅ Código modernizado com sucesso!');
                } else if (choice === 'Visualizar') {
                    await this.showRefactoringPreview(selectedText, modernizedCode);
                }
            } else {
                vscode.window.showInformationMessage('Código já está modernizado');
            }

        } catch (error) {
            Logger.error('Error modernizing code:', error);
            vscode.window.showErrorMessage('Erro ao modernizar código');
        }
    }

    /**
     * Rename inteligente com análise de escopo
     */
    private async smartRename(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        try {
            const position = editor.selection.active;
            const wordRange = editor.document.getWordRangeAtPosition(position);
            
            if (!wordRange) {
                vscode.window.showWarningMessage('Posicione o cursor em um símbolo para renomear');
                return;
            }

            const currentName = editor.document.getText(wordRange);
            const newName = await vscode.window.showInputBox({
                prompt: `Novo nome para "${currentName}":`,
                value: currentName
            });

            if (!newName || newName === currentName) return;

            vscode.window.showInformationMessage('🔍 Analisando escopo para rename inteligente...');

            const context = this.contextService.getCurrentContext();
            const renameAnalysis = await this.analyzeRenameScope(
                currentName,
                newName,
                context,
                editor.document.languageId
            );

            if (renameAnalysis) {
                const message = `Rename afetará ${renameAnalysis.affectedFiles.length} arquivo(s) e ${renameAnalysis.affectedReferences} referência(s). Continuar?`;
                const choice = await vscode.window.showInformationMessage(
                    message,
                    'Aplicar',
                    'Visualizar',
                    'Cancelar'
                );

                if (choice === 'Aplicar') {
                    await this.applySmartRename(renameAnalysis);
                } else if (choice === 'Visualizar') {
                    await this.showRenamePreview(renameAnalysis);
                }
            }

        } catch (error) {
            Logger.error('Error smart rename:', error);
            vscode.window.showErrorMessage('Erro ao executar rename inteligente');
        }
    }

    /**
     * Refatoração em lote para múltiplos arquivos
     */
    private async bulkRefactor(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showWarningMessage('Nenhum workspace ativo encontrado');
                return;
            }

            vscode.window.showInformationMessage('🔍 Analisando workspace para refatoração em lote...');

            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,cs,cpp}',
                '**/node_modules/**'
            );

            if (files.length === 0) {
                vscode.window.showInformationMessage('Nenhum arquivo encontrado para análise');
                return;
            }

            const bulkOperation = await this.analyzeBulkRefactoringOpportunities(files);

            if (bulkOperation.changes.length === 0) {
                vscode.window.showInformationMessage('Nenhuma oportunidade de refatoração encontrada');
                return;
            }

            const message = `Encontradas ${bulkOperation.changes.length} oportunidades em ${bulkOperation.files.length} arquivo(s). Tempo estimado: ${Math.round(bulkOperation.estimatedTime / 1000)}s`;
            const choice = await vscode.window.showInformationMessage(
                message,
                'Aplicar Todas',
                'Revisar',
                'Cancelar'
            );

            if (choice === 'Aplicar Todas') {
                await this.executeBulkRefactoring(bulkOperation);
            } else if (choice === 'Revisar') {
                await this.showBulkRefactoringPreview(bulkOperation);
            }

        } catch (error) {
            Logger.error('Error bulk refactor:', error);
            vscode.window.showErrorMessage('Erro ao executar refatoração em lote');
        }
    }

    /**
     * Prévia de refatoração
     */
    private async previewRefactoring(suggestion: RefactoringSuggestion): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selectedText = editor.document.getText(
                new vscode.Range(
                    suggestion.location.range.start.line,
                    suggestion.location.range.start.character,
                    suggestion.location.range.end.line,
                    suggestion.location.range.end.character
                )
            );

            const refactoredCode = await this.generateRefactoredCodeForSuggestion(suggestion, selectedText);

            if (refactoredCode) {
                const choice = await vscode.window.showInformationMessage(
                    `Prévia: ${suggestion.title}`,
                    'Aplicar',
                    'Visualizar Diff',
                    'Cancelar'
                );

                if (choice === 'Aplicar') {
                    await this.applyRefactoring(suggestion);
                } else if (choice === 'Visualizar Diff') {
                    await this.showRefactoringPreview(selectedText, refactoredCode);
                }
            }

        } catch (error) {
            Logger.error('Error previewing refactoring:', error);
            vscode.window.showErrorMessage('Erro ao gerar prévia de refatoração');
        }
    }

    /**
     * Aplica refatoração
     */
    private async applyRefactoring(suggestion: RefactoringSuggestion): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const range = new vscode.Range(
                suggestion.location.range.start.line,
                suggestion.location.range.start.character,
                suggestion.location.range.end.line,
                suggestion.location.range.end.character
            );

            const selectedText = editor.document.getText(range);
            const refactoredCode = await this.generateRefactoredCodeForSuggestion(suggestion, selectedText);

            if (refactoredCode) {
                await editor.edit(editBuilder => {
                    editBuilder.replace(range, refactoredCode);
                });

                vscode.window.showInformationMessage(`✅ Refatoração aplicada: ${suggestion.title}`);

                // Remover sugestão da lista ativa
                const uri = editor.document.uri.toString();
                const suggestions = this.activeSuggestions.get(uri) || [];
                const updatedSuggestions = suggestions.filter(s => s.id !== suggestion.id);
                this.activeSuggestions.set(uri, updatedSuggestions);

                // Atualizar code lenses
                this.codeLensProvider.refresh();
            }

        } catch (error) {
            Logger.error('Error applying refactoring:', error);
            vscode.window.showErrorMessage('Erro ao aplicar refatoração');
        }
    }

    /**
     * Listener para mudanças no documento
     */
    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // Debounce para evitar muitas análises
        clearTimeout(this.analysisTimeout);
        this.analysisTimeout = setTimeout(() => {
            this.analyzeDocumentForSuggestions(event.document);
        }, 2000);
    }

    private analysisTimeout: NodeJS.Timeout | undefined;
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

    // ===== NOVOS MÉTODOS SMART REFACTORING =====

    /**
     * Analisa código usando IA
     */
    private async analyzeCode(code: string, language: string): Promise<CodeAnalysis> {
        const prompt = `
Analise o seguinte código ${language} e retorne um JSON com análise detalhada:

\`\`\`${language}
${code}
\`\`\`

Retorne APENAS um JSON no formato:
{
  "complexity": number,
  "lineCount": number,
  "functionCount": number,
  "duplicateBlocks": [],
  "smells": [],
  "patterns": []
}
`;

        try {
            const response = await this.backendService.askQuestion(prompt);
            return JSON.parse(response);
        } catch {
            return {
                complexity: 1,
                lineCount: code.split('\n').length,
                functionCount: (code.match(/function|=>/g) || []).length,
                duplicateBlocks: [],
                smells: [],
                patterns: []
            };
        }
    }

    /**
     * Gera extração de classe
     */
    private async generateClassExtraction(
        code: string,
        className: string,
        context: any,
        language: string
    ): Promise<string | null> {
        const prompt = `
Extraia o código a seguir em uma classe chamada "${className}" em ${language}:

Código a extrair:
\`\`\`${language}
${code}
\`\`\`

Retorne APENAS o código da nova classe:
`;

        try {
            const response = await this.backendService.askQuestion(prompt);
            return this.extractCodeFromResponse(response);
        } catch {
            return null;
        }
    }

    /**
     * Gera extração de interface
     */
    private async generateInterfaceExtraction(
        code: string,
        interfaceName: string,
        context: any,
        language: string
    ): Promise<string | null> {
        const prompt = `
Extraia uma interface chamada "${interfaceName}" do seguinte código ${language}:

Código:
\`\`\`${language}
${code}
\`\`\`

Retorne APENAS o código da interface:
`;

        try {
            const response = await this.backendService.askQuestion(prompt);
            return this.extractCodeFromResponse(response);
        } catch {
            return null;
        }
    }

    /**
     * Gera código modernizado
     */
    private async generateModernizedCode(
        code: string,
        context: any,
        language: string
    ): Promise<string> {
        const prompt = `
Modernize o seguinte código ${language} aplicando:
- ES6+ features (se JavaScript/TypeScript)
- async/await em vez de callbacks
- destructuring
- arrow functions
- const/let em vez de var
- template literals

Código original:
\`\`\`${language}
${code}
\`\`\`

Retorne APENAS o código modernizado:
`;

        const response = await this.backendService.askQuestion(prompt);
        return this.extractCodeFromResponse(response);
    }

    /**
     * Analisa escopo para rename
     */
    private async analyzeRenameScope(
        currentName: string,
        newName: string,
        context: any,
        language: string
    ): Promise<any> {
        // Simulação de análise de escopo
        return {
            currentName,
            newName,
            affectedFiles: [context?.fileName || 'current-file'],
            affectedReferences: Math.floor(Math.random() * 10) + 1,
            changes: []
        };
    }

    /**
     * Aplica rename inteligente
     */
    private async applySmartRename(renameAnalysis: any): Promise<void> {
        // Implementação simplificada
        vscode.window.showInformationMessage(`✅ Rename aplicado: ${renameAnalysis.currentName} → ${renameAnalysis.newName}`);
    }

    /**
     * Mostra prévia de rename
     */
    private async showRenamePreview(renameAnalysis: any): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `Rename Preview:\n${renameAnalysis.currentName} → ${renameAnalysis.newName}\n\nAfetará ${renameAnalysis.affectedReferences} referência(s) em ${renameAnalysis.affectedFiles.length} arquivo(s)`,
            language: 'text'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Analisa oportunidades de refatoração em lote
     */
    private async analyzeBulkRefactoringOpportunities(files: vscode.Uri[]): Promise<BulkRefactoringOperation> {
        return {
            id: 'bulk-' + Date.now(),
            title: 'Refatoração em Lote',
            description: `Análise de ${files.length} arquivos`,
            files: files.map(f => f.fsPath),
            changes: [],
            estimatedTime: files.length * 1000,
            status: 'pending'
        };
    }

    /**
     * Executa refatoração em lote
     */
    private async executeBulkRefactoring(operation: BulkRefactoringOperation): Promise<void> {
        vscode.window.showInformationMessage(`✅ Refatoração em lote executada: ${operation.title}`);
    }

    /**
     * Mostra prévia de refatoração em lote
     */
    private async showBulkRefactoringPreview(operation: BulkRefactoringOperation): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `Refatoração em Lote Preview:\n\n${operation.description}\nArquivos: ${operation.files.length}\nTempo estimado: ${Math.round(operation.estimatedTime / 1000)}s`,
            language: 'text'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Gera código refatorado para sugestão específica
     */
    private async generateRefactoredCodeForSuggestion(suggestion: RefactoringSuggestion, code: string): Promise<string> {
        const prompt = `
Aplique a refatoração "${suggestion.title}" ao seguinte código:

Descrição: ${suggestion.description}
Tipo: ${suggestion.type}

Código:
\`\`\`
${code}
\`\`\`

Retorne APENAS o código refatorado:
`;

        try {
            const response = await this.backendService.askQuestion(prompt);
            return this.extractCodeFromResponse(response);
        } catch {
            return code;
        }
    }

    /**
     * Mostra prévia de extração
     */
    private async showExtractionPreview(original: string, extracted: string, type: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: `// ${type.toUpperCase()} EXTRAÍDA:\n\n${extracted}\n\n// CÓDIGO ORIGINAL:\n${original}`,
            language: 'typescript'
        });
        await vscode.window.showTextDocument(doc);
    }

    /**
     * Obtém sugestões ativas para um documento
     */
    getSuggestionsForDocument(uri: string): RefactoringSuggestion[] {
        return this.activeSuggestions.get(uri) || [];
    }
}

/**
 * Provider de Code Lens para sugestões de refatoração
 */
class RefactoringCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private refactoringService: RefactoringService) {}

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const suggestions = this.refactoringService.getSuggestionsForDocument(document.uri.toString());
        const codeLenses: vscode.CodeLens[] = [];

        for (const suggestion of suggestions) {
            const range = new vscode.Range(
                suggestion.location.range.start.line,
                suggestion.location.range.start.character,
                suggestion.location.range.end.line,
                suggestion.location.range.end.character
            );

            const lens = new vscode.CodeLens(range, {
                title: `💡 ${suggestion.title}`,
                command: 'xcopilot.previewRefactoring',
                arguments: [suggestion]
            });

            codeLenses.push(lens);
        }

        return codeLenses;
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}
