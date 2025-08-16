import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';

/**
 * Interface para padrões detectados
 */
interface DetectedPattern {
    type: string;
    description: string;
    location: vscode.Range;
    severity: 'info' | 'warning' | 'error';
    suggestion: string;
    autoFixAvailable: boolean;
}

/**
 * Serviço para detecção de padrões de código
 */
export class PatternDetectionService {
    private static instance: PatternDetectionService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private isEnabled = true;
    private analysisDebounceTimer: NodeJS.Timeout | undefined;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('xcopilot-patterns');
        this.setupDocumentWatcher();
    }

    static getInstance(): PatternDetectionService {
        if (!PatternDetectionService.instance) {
            PatternDetectionService.instance = new PatternDetectionService();
        }
        return PatternDetectionService.instance;
    }

    /**
     * Configura o monitoramento de documentos
     */
    private setupDocumentWatcher(): void {
        // Analisar quando o documento for salvo
        vscode.workspace.onDidSaveTextDocument(document => {
            if (this.isEnabled && this.shouldAnalyzeFile(document)) {
                this.analyzeDocument(document);
            }
        });

        // Analisar mudanças em tempo real (com debounce)
        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.isEnabled && this.shouldAnalyzeFile(event.document)) {
                this.scheduleAnalysis(event.document);
            }
        });

        // Analisar quando um documento for aberto
        vscode.workspace.onDidOpenTextDocument(document => {
            if (this.isEnabled && this.shouldAnalyzeFile(document)) {
                this.analyzeDocument(document);
            }
        });
    }

    /**
     * Agenda análise com debounce
     */
    private scheduleAnalysis(document: vscode.TextDocument): void {
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
        }

        this.analysisDebounceTimer = setTimeout(() => {
            this.analyzeDocument(document);
        }, 2000); // 2 segundos de debounce
    }

    /**
     * Verifica se deve analisar o arquivo
     */
    private shouldAnalyzeFile(document: vscode.TextDocument): boolean {
        const supportedLanguages = [
            'typescript', 'javascript', 'python', 'java', 'csharp',
            'cpp', 'c', 'php', 'ruby', 'go', 'rust'
        ];

        return supportedLanguages.includes(document.languageId) &&
            !document.isUntitled &&
            document.uri.scheme === 'file';
    }

    /**
     * Analisa documento e detecta padrões
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        try {
            Logger.info(`Analyzing patterns in ${document.fileName}`);

            const patterns = await this.detectPatterns(document);
            this.updateDiagnostics(document, patterns);

            // Mostrar notificação se padrões críticos forem encontrados
            const criticalPatterns = patterns.filter(p => p.severity === 'error');
            if (criticalPatterns.length > 0) {
                const choice = await vscode.window.showWarningMessage(
                    `${criticalPatterns.length} padrão(ões) crítico(s) detectado(s) em ${document.fileName}`,
                    'Ver Problemas',
                    'Ignorar'
                );

                if (choice === 'Ver Problemas') {
                    vscode.commands.executeCommand('workbench.panel.markers.view.focus');
                }
            }

        } catch (error) {
            Logger.error('Error analyzing document patterns:', error);
        }
    }

    /**
     * Detecta padrões no documento
     */
    private async detectPatterns(document: vscode.TextDocument): Promise<DetectedPattern[]> {
        const content = document.getText();
        const patterns: DetectedPattern[] = [];

        // Análise local de padrões comuns
        patterns.push(...await this.detectLocalPatterns(document, content));

        // Análise com IA para padrões complexos
        patterns.push(...await this.detectAIPatterns(document, content));

        return patterns;
    }

    /**
     * Detecta padrões locais (sem IA)
     */
    private async detectLocalPatterns(document: vscode.TextDocument, content: string): Promise<DetectedPattern[]> {
        const patterns: DetectedPattern[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i;

            // Detectar código duplicado simples
            if (this.isCodeDuplication(lines, i)) {
                patterns.push({
                    type: 'code-duplication',
                    description: 'Possível código duplicado detectado',
                    location: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    severity: 'warning',
                    suggestion: 'Considere extrair em uma função reutilizável',
                    autoFixAvailable: false
                });
            }

            // Detectar funções muito longas
            if (this.isLongFunction(lines, i)) {
                patterns.push({
                    type: 'long-function',
                    description: 'Função muito longa detectada',
                    location: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    severity: 'info',
                    suggestion: 'Considere dividir em funções menores',
                    autoFixAvailable: true
                });
            }

            // Detectar funções com muitos parâmetros
            if (this.hasTooManyParameters(line)) {
                patterns.push({
                    type: 'excessive-parameters',
                    description: 'Função com muitos parâmetros detectada',
                    location: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    severity: 'warning',
                    suggestion: 'Considere usar um objeto ou extrair para classe',
                    autoFixAvailable: true
                });
            }

            // Detectar complexidade ciclomática alta
            if (this.isHighComplexity(line)) {
                patterns.push({
                    type: 'high-complexity',
                    description: 'Alta complexidade ciclomática',
                    location: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    severity: 'warning',
                    suggestion: 'Simplifique a lógica condicional',
                    autoFixAvailable: false
                });
            }

            // Detectar magic numbers
            const magicNumbers = this.findMagicNumbers(line);
            for (const magicNumber of magicNumbers) {
                patterns.push({
                    type: 'magic-number',
                    description: `Número mágico detectado: ${magicNumber.value}`,
                    location: new vscode.Range(lineNumber, magicNumber.start, lineNumber, magicNumber.end),
                    severity: 'info',
                    suggestion: 'Considere usar uma constante nomeada',
                    autoFixAvailable: true
                });
            }

            // Detectar TODO/FIXME
            const todoMatch = line.match(/(TODO|FIXME|HACK):\s*(.+)/i);
            if (todoMatch) {
                patterns.push({
                    type: 'todo',
                    description: `${todoMatch[1]}: ${todoMatch[2]}`,
                    location: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                    severity: 'info',
                    suggestion: 'Item pendente identificado',
                    autoFixAvailable: false
                });
            }
        }

        return patterns;
    }

    /**
     * Detecta padrões usando IA
     */
    private async detectAIPatterns(document: vscode.TextDocument, content: string): Promise<DetectedPattern[]> {
        try {
            // Analisar apenas uma amostra para não sobrecarregar a IA
            const sample = content.length > 2000 ? content.substring(0, 2000) + '...' : content;

            const prompt = `
Analise o seguinte código ${document.languageId} e detecte padrões problemáticos:

\`\`\`${document.languageId}
${sample}
\`\`\`

Identifique:
1. Anti-padrões de design
2. Violações de princípios SOLID
3. Problemas de performance
4. Vulnerabilidades de segurança
5. Código mal estruturado

Para cada padrão encontrado, retorne JSON no formato:
{
  "patterns": [
    {
      "type": "tipo-do-padrao",
      "description": "descrição do problema",
      "line": número_da_linha_aproximado,
      "severity": "info|warning|error",
      "suggestion": "sugestão de melhoria"
    }
  ]
}
`;

            const response = await this.backendService.askQuestion(prompt);
            const analysisResult = this.parseAIResponse(response, document);

            return analysisResult;

        } catch (error) {
            Logger.error('Error in AI pattern detection:', error);
            return [];
        }
    }

    /**
     * Parse da resposta da IA
     */
    private parseAIResponse(response: string, document: vscode.TextDocument): DetectedPattern[] {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return [];

            const parsed = JSON.parse(jsonMatch[0]);
            const patterns: DetectedPattern[] = [];

            if (parsed.patterns && Array.isArray(parsed.patterns)) {
                for (const pattern of parsed.patterns) {
                    const lineNumber = Math.max(0, Math.min(pattern.line - 1, document.lineCount - 1));
                    const line = document.lineAt(lineNumber);

                    patterns.push({
                        type: pattern.type || 'ai-detected',
                        description: pattern.description || 'Padrão detectado pela IA',
                        location: new vscode.Range(lineNumber, 0, lineNumber, line.text.length),
                        severity: pattern.severity || 'info',
                        suggestion: pattern.suggestion || 'Revisar código',
                        autoFixAvailable: false
                    });
                }
            }

            return patterns;

        } catch (error) {
            Logger.error('Error parsing AI response:', error);
            return [];
        }
    }

    /**
     * Atualiza diagnósticos no VS Code
     */
    private updateDiagnostics(document: vscode.TextDocument, patterns: DetectedPattern[]): void {
        const diagnostics: vscode.Diagnostic[] = patterns.map(pattern => {
            const diagnostic = new vscode.Diagnostic(
                pattern.location,
                `[${pattern.type}] ${pattern.description}`,
                this.severityToVSCode(pattern.severity)
            );

            diagnostic.source = 'xCopilot Pattern Detection';
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    /**
     * Converte severidade para VS Code
     */
    private severityToVSCode(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info':
            default: return vscode.DiagnosticSeverity.Information;
        }
    }

    /**
     * Detecta duplicação de código simples
     */
    private isCodeDuplication(lines: string[], currentIndex: number): boolean {
        const currentLine = lines[currentIndex].trim();
        if (currentLine.length < 20) return false; // Muito curto para ser relevante

        let duplicateCount = 0;
        for (let i = 0; i < lines.length; i++) {
            if (i !== currentIndex && lines[i].trim() === currentLine) {
                duplicateCount++;
            }
        }

        return duplicateCount >= 2; // 3 ou mais ocorrências (incluindo a atual)
    }

    /**
     * Detecta funções muito longas
     */
    private isLongFunction(lines: string[], currentIndex: number): boolean {
        const line = lines[currentIndex];
        const functionRegex = /(function|def|void|int|string|bool|var|let|const)\s+\w+\s*\(/;

        if (!functionRegex.test(line)) return false;

        // Contar linhas até o fechamento da função
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

        return lineCount > 20; // Função com mais de 20 linhas
    }

    /**
     * Detecta alta complexidade ciclomática
     */
    private isHighComplexity(line: string): boolean {
        const complexityKeywords = ['if', 'else', 'switch', 'case', 'for', 'while', 'catch', '&&', '||'];
        let complexityScore = 0;

        for (const keyword of complexityKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = line.match(regex);
            if (matches) {
                complexityScore += matches.length;
            }
        }

        return complexityScore >= 4; // Mais de 4 condições em uma linha
    }

    /**
     * Detecta funções com muitos parâmetros
     */
    private hasTooManyParameters(line: string): boolean {
        // Regex para capturar definições de função
        const functionRegex = /(function\s+\w+\s*\(([^)]*)\)|(\w+)\s*\(([^)]*)\)\s*\{|(\w+)\s*:\s*\(([^)]*)\)\s*=>|(\w+)\s*=\s*\(([^)]*)\)\s*=>)/;
        const match = line.match(functionRegex);
        
        if (!match) return false;

        // Extrair parâmetros da função
        const params = match[2] || match[4] || match[6] || match[8] || '';
        
        if (!params.trim()) return false;

        // Contar parâmetros (separados por vírgula, ignorando espaços)
        const parameterCount = params.split(',').filter(p => p.trim().length > 0).length;
        
        return parameterCount > 5; // Mais de 5 parâmetros
    }

    /**
     * Encontra magic numbers
     */
    private findMagicNumbers(line: string): Array<{ value: string; start: number; end: number }> {
        const magicNumbers: Array<{ value: string; start: number; end: number }> = [];
        const numberRegex = /\b(\d+\.?\d*)\b/g;

        let match;
        while ((match = numberRegex.exec(line)) !== null) {
            const value = match[1];
            // Ignorar números comuns que geralmente não são mágicos
            if (!['0', '1', '2', '10', '100', '1000'].includes(value)) {
                magicNumbers.push({
                    value,
                    start: match.index,
                    end: match.index + value.length
                });
            }
        }

        return magicNumbers;
    }

    /**
     * Registra comandos relacionados à detecção de padrões
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Comando para analisar arquivo atual
        const analyzeCommand = vscode.commands.registerCommand(
            'xcopilot.analyzePatterns',
            () => this.analyzeCurrentFile()
        );

        // Comando para analisar workspace inteiro
        const analyzeWorkspaceCommand = vscode.commands.registerCommand(
            'xcopilot.analyzeWorkspacePatterns',
            () => this.analyzeWorkspace()
        );

        // Comando para toggle da detecção automática
        const toggleCommand = vscode.commands.registerCommand(
            'xcopilot.togglePatternDetection',
            () => this.togglePatternDetection()
        );

        context.subscriptions.push(analyzeCommand, analyzeWorkspaceCommand, toggleCommand);
    }

    /**
     * Analisa arquivo atual
     */
    private async analyzeCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum arquivo ativo para analisar');
            return;
        }

        vscode.window.showInformationMessage('🔍 Analisando padrões de código...');
        await this.analyzeDocument(editor.document);
        vscode.window.showInformationMessage('✅ Análise de padrões concluída!');
    }

    /**
     * Analisa workspace inteiro
     */
    private async analyzeWorkspace(): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cs,cpp,c,php,rb,go,rs}');

        if (files.length === 0) {
            vscode.window.showInformationMessage('Nenhum arquivo de código encontrado no workspace');
            return;
        }

        vscode.window.showInformationMessage(`🔍 Analisando ${files.length} arquivo(s)...`);

        for (const fileUri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                await this.analyzeDocument(document);
            } catch (error) {
                Logger.error(`Error analyzing file ${fileUri.fsPath}:`, error);
            }
        }

        vscode.window.showInformationMessage('✅ Análise do workspace concluída!');
    }

    /**
     * Toggle da detecção automática
     */
    private togglePatternDetection(): void {
        this.isEnabled = !this.isEnabled;

        if (!this.isEnabled) {
            this.diagnosticCollection.clear();
        }

        vscode.window.showInformationMessage(
            `Detecção de padrões ${this.isEnabled ? 'ativada' : 'desativada'}`
        );
    }

    /**
     * Obtém disposables para limpeza
     */
    getDisposables(): vscode.Disposable[] {
        return [this.diagnosticCollection];
    }

    /**
     * Limpa recursos
     */
    dispose(): void {
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
        }
        this.diagnosticCollection.dispose();
    }
}
