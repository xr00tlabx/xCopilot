import * as vscode from 'vscode';
import { PatternDetectionService } from './PatternDetectionService';
import { RefactoringService } from './RefactoringService';

/**
 * Interface para sugestões de refatoração
 */
interface RefactoringSuggestion {
    range: vscode.Range;
    type: string;
    description: string;
    command: string;
    args?: any[];
}

/**
 * Provider para Code Lens com sugestões de refatoração
 */
export class RefactoringCodeLensProvider implements vscode.CodeLensProvider {
    private static instance: RefactoringCodeLensProvider;
    private patternDetectionService: PatternDetectionService;
    private refactoringService: RefactoringService;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    private constructor() {
        this.patternDetectionService = PatternDetectionService.getInstance();
        this.refactoringService = RefactoringService.getInstance();
    }

    static getInstance(): RefactoringCodeLensProvider {
        if (!RefactoringCodeLensProvider.instance) {
            RefactoringCodeLensProvider.instance = new RefactoringCodeLensProvider();
        }
        return RefactoringCodeLensProvider.instance;
    }

    /**
     * Fornece CodeLens para o documento
     */
    async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        try {
            const suggestions = await this.detectRefactoringSuggestions(document);

            for (const suggestion of suggestions) {
                const codeLens = new vscode.CodeLens(suggestion.range, {
                    title: `💡 ${suggestion.description}`,
                    command: suggestion.command,
                    arguments: suggestion.args || []
                });

                codeLenses.push(codeLens);
            }
        } catch (error) {
            console.error('Error providing code lenses:', error);
        }

        return codeLenses;
    }

    /**
     * Detecta sugestões de refatoração para o documento
     */
    private async detectRefactoringSuggestions(document: vscode.TextDocument): Promise<RefactoringSuggestion[]> {
        const suggestions: RefactoringSuggestion[] = [];
        const content = document.getText();
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i;

            // Detectar funções longas
            if (this.isLongFunction(lines, i)) {
                const functionRange = this.getFunctionRange(lines, i);
                suggestions.push({
                    range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    type: 'extract-method',
                    description: 'Extract function - Function too long',
                    command: 'xcopilot.extractMethod',
                    args: [document.uri, functionRange]
                });
            }

            // Detectar funções com muitos parâmetros
            if (this.hasTooManyParameters(line)) {
                suggestions.push({
                    range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    type: 'extract-class',
                    description: 'Extract to class - Too many parameters',
                    command: 'xcopilot.extractClass',
                    args: [document.uri, new vscode.Range(lineNumber, 0, lineNumber, line.length)]
                });
            }

            // Detectar código duplicado
            if (this.isCodeDuplication(lines, i)) {
                suggestions.push({
                    range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    type: 'extract-method',
                    description: 'Extract method - Duplicate code',
                    command: 'xcopilot.extractDuplicatedCode',
                    args: [document.uri, new vscode.Range(lineNumber, 0, lineNumber, line.length)]
                });
            }

            // Detectar oportunidades de modernização de código
            const modernizationSuggestions = this.detectModernizationOpportunities(line, lineNumber);
            suggestions.push(...modernizationSuggestions);
        }

        return suggestions;
    }

    /**
     * Detecta oportunidades de modernização de código
     */
    private detectModernizationOpportunities(line: string, lineNumber: number): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];

        // Detectar callbacks que podem ser convertidos para async/await
        if (this.canConvertToAsyncAwait(line)) {
            suggestions.push({
                range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                type: 'modernize-async',
                description: 'Convert to async/await',
                command: 'xcopilot.convertToAsyncAwait',
                args: [lineNumber]
            });
        }

        // Detectar funções que podem ser convertidas para arrow functions
        if (this.canConvertToArrowFunction(line)) {
            suggestions.push({
                range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                type: 'modernize-arrow',
                description: 'Convert to arrow function',
                command: 'xcopilot.convertToArrowFunction',
                args: [lineNumber]
            });
        }

        // Detectar oportunidades de destructuring
        if (this.canUseDestructuring(line)) {
            suggestions.push({
                range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                type: 'modernize-destructuring',
                description: 'Use destructuring',
                command: 'xcopilot.applyDestructuring',
                args: [lineNumber]
            });
        }

        return suggestions;
    }

    /**
     * Verifica se pode converter callback para async/await
     */
    private canConvertToAsyncAwait(line: string): boolean {
        // Detectar padrões de callback comuns
        const callbackPatterns = [
            /\.then\s*\(/,
            /\.catch\s*\(/,
            /callback\s*\(/,
            /function\s*\(\s*err\s*,/
        ];

        return callbackPatterns.some(pattern => pattern.test(line));
    }

    /**
     * Verifica se pode converter para arrow function
     */
    private canConvertToArrowFunction(line: string): boolean {
        // Detectar função anônima tradicional
        return /function\s*\([^)]*\)\s*\{/.test(line) && !line.includes('function ');
    }

    /**
     * Verifica se pode usar destructuring
     */
    private canUseDestructuring(line: string): boolean {
        // Detectar acessos múltiplos a propriedades do mesmo objeto
        const objectAccessPattern = /(\w+)\.(\w+).*\1\.(\w+)/;
        return objectAccessPattern.test(line);
    }

    // Métodos auxiliares reutilizados do PatternDetectionService
    private isLongFunction(lines: string[], currentIndex: number): boolean {
        const line = lines[currentIndex];
        const functionRegex = /(function|def|void|int|string|bool|var|let|const)\s+\w+\s*\(/;

        if (!functionRegex.test(line)) return false;

        let braceCount = 0;
        let lineCount = 0;
        let started = false;

        for (let i = currentIndex; i < lines.length; i++) {
            const currentLine = lines[i];

            if (currentLine.includes('{')) {
                braceCount += (currentLine.match(/\{/g) || []).length;
                started = true;
            }

            if (currentLine.includes('}')) {
                braceCount -= (currentLine.match(/\}/g) || []).length;
            }

            if (started) {
                lineCount++;
                if (braceCount === 0) break;
            }
        }

        return lineCount > 20;
    }

    private hasTooManyParameters(line: string): boolean {
        const functionRegex = /(function\s+\w+\s*\(([^)]*)\)|(\w+)\s*\(([^)]*)\)\s*\{|(\w+)\s*:\s*\(([^)]*)\)\s*=>|(\w+)\s*=\s*\(([^)]*)\)\s*=>)/;
        const match = line.match(functionRegex);

        if (!match) return false;

        const params = match[2] || match[4] || match[6] || match[8] || '';

        if (!params.trim()) return false;

        const parameterCount = params.split(',').filter(p => p.trim().length > 0).length;

        return parameterCount > 5;
    }

    private isCodeDuplication(lines: string[], currentIndex: number): boolean {
        const currentLine = lines[currentIndex].trim();
        if (currentLine.length < 20) return false;

        let duplicateCount = 0;
        for (let i = 0; i < lines.length; i++) {
            if (i !== currentIndex && lines[i].trim() === currentLine) {
                duplicateCount++;
            }
        }

        return duplicateCount >= 2;
    }

    private getFunctionRange(lines: string[], startIndex: number): vscode.Range {
        let braceCount = 0;
        let endIndex = startIndex;
        let started = false;

        for (let i = startIndex; i < lines.length; i++) {
            const currentLine = lines[i];

            if (currentLine.includes('{')) {
                braceCount += (currentLine.match(/\{/g) || []).length;
                started = true;
            }

            if (currentLine.includes('}')) {
                braceCount -= (currentLine.match(/\}/g) || []).length;
            }

            if (started && braceCount === 0) {
                endIndex = i;
                break;
            }
        }

        return new vscode.Range(startIndex, 0, endIndex, lines[endIndex]?.length || 0);
    }

    /**
     * Atualiza as CodeLenses
     */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Registra o provider
     */
    register(context: vscode.ExtensionContext): void {
        const supportedLanguages = [
            'typescript', 'javascript', 'python', 'java', 'csharp'
        ];

        for (const language of supportedLanguages) {
            const disposable = vscode.languages.registerCodeLensProvider(
                { language },
                this
            );
            context.subscriptions.push(disposable);
        }
    }
}

