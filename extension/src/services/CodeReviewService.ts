import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { CodeReviewResult, CodeReviewIssue, ReviewConfig } from '../types';
import { PatternDetectionService } from './PatternDetectionService';
import { GitIntegrationService } from './GitIntegrationService.new';
import { BackendService } from './BackendService';
import { ConfigurationService } from './ConfigurationService';

/**
 * Serviço para análise automática de code review com IA
 */
export class CodeReviewService {
    private static instance: CodeReviewService;
    private patternDetectionService: PatternDetectionService;
    private gitService: GitIntegrationService;
    private backendService: BackendService;
    private configService: ConfigurationService;

    private constructor() {
        this.patternDetectionService = PatternDetectionService.getInstance();
        this.gitService = GitIntegrationService.getInstance();
        this.backendService = BackendService.getInstance();
        this.configService = ConfigurationService.getInstance();
        this.registerCommands();
    }

    static getInstance(): CodeReviewService {
        if (!CodeReviewService.instance) {
            CodeReviewService.instance = new CodeReviewService();
        }
        return CodeReviewService.instance;
    }

    /**
     * Registra comandos relacionados ao code review
     */
    private registerCommands(): void {
        vscode.commands.registerCommand('xcopilot.reviewCurrentFile', () => this.reviewCurrentFile());
        vscode.commands.registerCommand('xcopilot.reviewChangedFiles', () => this.reviewChangedFiles());
        vscode.commands.registerCommand('xcopilot.reviewWorkspace', () => this.reviewWorkspace());
        vscode.commands.registerCommand('xcopilot.generateReviewSummary', () => this.generateReviewSummary());
    }

    /**
     * Realiza review do arquivo atual
     */
    async reviewCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum arquivo aberto para review');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando arquivo...',
                cancellable: false
            }, async () => {
                const result = await this.analyzeFile(editor.document);
                await this.showReviewResults(result);
            });
        } catch (error) {
            Logger.error('Error reviewing current file:', error);
            vscode.window.showErrorMessage('Erro ao analisar arquivo: ' + (error as Error).message);
        }
    }

    /**
     * Realiza review dos arquivos modificados
     */
    async reviewChangedFiles(): Promise<void> {
        if (!this.gitService.isGitAvailable()) {
            vscode.window.showWarningMessage('Git não disponível no workspace atual');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando arquivos modificados...',
                cancellable: false
            }, async () => {
                const gitInfo = await this.gitService.getGitInfo();
                if (!gitInfo?.changedFiles.length) {
                    vscode.window.showInformationMessage('Nenhum arquivo modificado encontrado');
                    return;
                }

                const results: CodeReviewResult[] = [];
                for (const filePath of gitInfo.changedFiles) {
                    const document = await this.openDocument(filePath);
                    if (document) {
                        const result = await this.analyzeFile(document);
                        results.push(result);
                    }
                }

                const combinedResult = this.combineReviewResults(results);
                await this.showReviewResults(combinedResult);
            });
        } catch (error) {
            Logger.error('Error reviewing changed files:', error);
            vscode.window.showErrorMessage('Erro ao analisar arquivos modificados: ' + (error as Error).message);
        }
    }

    /**
     * Realiza review completo do workspace
     */
    async reviewWorkspace(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            vscode.window.showWarningMessage('Nenhum workspace aberto');
            return;
        }

        const include = '**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,php,go,rs,rb,swift,kt}';
        const exclude = '**/node_modules/**';

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analisando workspace...',
                cancellable: false
            }, async (progress) => {
                const files = await vscode.workspace.findFiles(include, exclude, 50); // Limitar a 50 arquivos
                const results: CodeReviewResult[] = [];

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    progress.report({
                        message: `Analisando ${file.fsPath}`,
                        increment: (100 / files.length)
                    });

                    const document = await this.openDocument(file.fsPath);
                    if (document) {
                        const result = await this.analyzeFile(document);
                        results.push(result);
                    }
                }

                const combinedResult = this.combineReviewResults(results);
                await this.showReviewResults(combinedResult);
            });
        } catch (error) {
            Logger.error('Error reviewing workspace:', error);
            vscode.window.showErrorMessage('Erro ao analisar workspace: ' + (error as Error).message);
        }
    }

    /**
     * Gera summary do review
     */
    async generateReviewSummary(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Gerando summary de review...',
                cancellable: false
            }, async () => {
                const gitInfo = await this.gitService.getGitInfo();
                const summary = await this.generateAISummary(gitInfo);
                await this.showSummary(summary);
            });
        } catch (error) {
            Logger.error('Error generating review summary:', error);
            vscode.window.showErrorMessage('Erro ao gerar summary: ' + (error as Error).message);
        }
    }

    /**
     * Analisa um arquivo específico
     */
    private async analyzeFile(document: vscode.TextDocument): Promise<CodeReviewResult> {
        const issues: CodeReviewIssue[] = [];
        const fileName = document.fileName;
        const content = document.getText();
        const language = document.languageId;

        // 1. Análise de qualidade de código
        const codeQualityIssues = await this.analyzeCodeQuality(content, language, fileName);
        issues.push(...codeQualityIssues);

        // 2. Verificação de best practices
        const bestPracticeIssues = await this.analyzeBestPractices(content, language, fileName);
        issues.push(...bestPracticeIssues);

        // 3. Análise de segurança
        const securityIssues = await this.analyzeSecurityIssues(content, language, fileName);
        issues.push(...securityIssues);

        // 4. Verificação de testes
        const testingIssues = await this.analyzeTestCoverage(content, language, fileName);
        issues.push(...testingIssues);

        // 5. Análise de documentação
        const documentationIssues = await this.analyzeDocumentation(content, language, fileName);
        issues.push(...documentationIssues);

        // 6. Análise de performance
        const performanceIssues = await this.analyzePerformance(content, language, fileName);
        issues.push(...performanceIssues);

        return this.calculateReviewScore(issues, [fileName]);
    }

    /**
     * Analisa qualidade do código
     */
    private async analyzeCodeQuality(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];
        const lines = content.split('\n');

        // Detectar funções muito longas
        let functionStartLine = -1;
        let functionLines = 0;
        let braceCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detectar início de função
            if (this.isFunctionStart(line, language)) {
                functionStartLine = i;
                functionLines = 0;
                braceCount = 0;
            }

            if (functionStartLine >= 0) {
                functionLines++;
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;

                // Fim da função
                if (braceCount === 0 && functionLines > 1) {
                    if (functionLines > 20) {
                        issues.push({
                            type: 'code_smell',
                            severity: functionLines > 50 ? 'high' : 'medium',
                            message: `Função muito longa (${functionLines} linhas)`,
                            suggestion: 'Considere quebrar em funções menores para melhor legibilidade',
                            file: fileName,
                            line: functionStartLine + 1,
                            endLine: i + 1,
                            autoFixAvailable: false
                        });
                    }
                    functionStartLine = -1;
                }
            }

            // Detectar complexidade ciclomática alta
            const complexityKeywords = ['if', 'else', 'switch', 'case', 'for', 'while', 'catch', '&&', '||'];
            let complexity = 0;
            for (const keyword of complexityKeywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                const matches = line.match(regex);
                if (matches) {
                    complexity += matches.length;
                }
            }

            if (complexity >= 5) {
                issues.push({
                    type: 'code_smell',
                    severity: complexity >= 10 ? 'high' : 'medium',
                    message: `Alta complexidade ciclomática (${complexity} condições)`,
                    suggestion: 'Simplifique a lógica ou extraia condições para métodos separados',
                    file: fileName,
                    line: i + 1,
                    autoFixAvailable: false
                });
            }

            // Detectar duplicação de código
            if (this.isCodeDuplication(lines, i)) {
                issues.push({
                    type: 'code_smell',
                    severity: 'medium',
                    message: 'Possível duplicação de código detectada',
                    suggestion: 'Extraia código comum para uma função ou método separado',
                    file: fileName,
                    line: i + 1,
                    autoFixAvailable: false
                });
            }
        }

        return issues;
    }

    /**
     * Analisa best practices
     */
    private async analyzeBestPractices(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Magic numbers
            const magicNumberRegex = /\b(\d{2,})\b/g;
            let match;
            while ((match = magicNumberRegex.exec(line)) !== null) {
                const number = parseInt(match[1]);
                if (number > 1 && number !== 100 && number !== 1000) { // Ignore common values
                    issues.push({
                        type: 'best_practice',
                        severity: 'low',
                        message: `Magic number detectado: ${number}`,
                        suggestion: 'Considere usar uma constante nomeada',
                        file: fileName,
                        line: i + 1,
                        column: match.index,
                        autoFixAvailable: false
                    });
                }
            }

            // Nomes de variáveis muito curtos
            const varRegex = /\b(var|let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
            while ((match = varRegex.exec(line)) !== null) {
                const varName = match[2];
                if (varName.length <= 2 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(varName)) {
                    issues.push({
                        type: 'best_practice',
                        severity: 'low',
                        message: `Nome de variável muito curto: ${varName}`,
                        suggestion: 'Use nomes mais descritivos para variáveis',
                        file: fileName,
                        line: i + 1,
                        autoFixAvailable: false
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Analisa problemas de segurança
     */
    private async analyzeSecurityIssues(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // SQL Injection patterns
            if (line.includes('SELECT') && (line.includes('+') || line.includes('${') || line.includes('`'))) {
                issues.push({
                    type: 'security',
                    severity: 'high',
                    message: 'Possível vulnerabilidade de SQL Injection',
                    suggestion: 'Use prepared statements ou parameterized queries',
                    file: fileName,
                    line: i + 1,
                    autoFixAvailable: false
                });
            }

            // Hardcoded passwords/secrets
            const secretPatterns = [
                /password\s*[:=]\s*["'].*["']/i,
                /api[_-]?key\s*[:=]\s*["'].*["']/i,
                /secret\s*[:=]\s*["'].*["']/i,
                /token\s*[:=]\s*["'].*["']/i
            ];

            for (const pattern of secretPatterns) {
                if (pattern.test(line)) {
                    issues.push({
                        type: 'security',
                        severity: 'critical',
                        message: 'Possível credencial hardcoded detectada',
                        suggestion: 'Use variáveis de ambiente ou serviços de secrets management',
                        file: fileName,
                        line: i + 1,
                        autoFixAvailable: false
                    });
                }
            }

            // Eval usage
            if (line.includes('eval(')) {
                issues.push({
                    type: 'security',
                    severity: 'high',
                    message: 'Uso de eval() detectado',
                    suggestion: 'Evite usar eval() por questões de segurança',
                    file: fileName,
                    line: i + 1,
                    autoFixAvailable: false
                });
            }
        }

        return issues;
    }

    /**
     * Analisa cobertura de testes
     */
    private async analyzeTestCoverage(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];

        // Verificar se é arquivo de teste
        const isTestFile = /\.(test|spec)\.(js|ts|py|java)$/.test(fileName) ||
                          fileName.includes('__tests__') ||
                          fileName.includes('/tests/');

        if (isTestFile) {
            return issues; // Não analisar arquivos de teste
        }

        // Contar funções públicas
        const lines = content.split('\n');
        let publicFunctions = 0;
        let hasTests = false;

        for (const line of lines) {
            if (this.isPublicFunction(line, language)) {
                publicFunctions++;
            }
        }

        // Verificar se há arquivos de teste correspondentes
        const baseName = fileName.replace(/\.(js|ts|py|java)$/, '');
        const testFiles = [
            `${baseName}.test.${language}`,
            `${baseName}.spec.${language}`,
            `${baseName.replace('/src/', '/tests/')}.test.${language}`,
            `${baseName}/${fileName.split('/').pop()?.replace(/\.(js|ts|py|java)$/, '')}.test.${language}`
        ];

        // Simplificado: assumir que não há testes (seria necessário verificar sistema de arquivos)
        if (publicFunctions > 0 && !hasTests) {
            issues.push({
                type: 'testing',
                severity: 'medium',
                message: `Arquivo com ${publicFunctions} função(ões) pública(s) sem testes`,
                suggestion: 'Adicione testes unitários para cobrir as funções públicas',
                file: fileName,
                autoFixAvailable: false
            });
        }

        return issues;
    }

    /**
     * Analisa documentação
     */
    private async analyzeDocumentation(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Verificar funções públicas sem JSDoc/docstring
            if (this.isPublicFunction(line, language)) {
                const previousLine = i > 0 ? lines[i - 1].trim() : '';
                const hasDoc = previousLine.includes('/**') || previousLine.includes('"""') || 
                              previousLine.includes('/*') || line.includes('//');

                if (!hasDoc) {
                    issues.push({
                        type: 'documentation',
                        severity: 'low',
                        message: 'Função pública sem documentação',
                        suggestion: 'Adicione JSDoc/docstring explicando o propósito da função',
                        file: fileName,
                        line: i + 1,
                        autoFixAvailable: false
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Analisa problemas de performance
     */
    private async analyzePerformance(content: string, language: string, fileName: string): Promise<CodeReviewIssue[]> {
        const issues: CodeReviewIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Loops aninhados
            if (line.includes('for') && i < lines.length - 10) {
                let nestedLoops = 0;
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    if (lines[j].trim().includes('for') || lines[j].trim().includes('while')) {
                        nestedLoops++;
                    }
                }

                if (nestedLoops >= 2) {
                    issues.push({
                        type: 'performance',
                        severity: 'medium',
                        message: `Loops aninhados detectados (${nestedLoops + 1} níveis)`,
                        suggestion: 'Considere otimizar a lógica ou usar estruturas de dados mais eficientes',
                        file: fileName,
                        line: i + 1,
                        autoFixAvailable: false
                    });
                }
            }

            // Array.push em loop
            if (line.includes('.push(') && (line.includes('for') || 
                (i > 0 && lines[i-1].includes('for')))) {
                issues.push({
                    type: 'performance',
                    severity: 'low',
                    message: 'Array.push() em loop pode ser ineficiente',
                    suggestion: 'Considere usar spread operator ou Array.concat()',
                    file: fileName,
                    line: i + 1,
                    autoFixAvailable: false
                });
            }
        }

        return issues;
    }

    /**
     * Calcula score do review
     */
    private calculateReviewScore(issues: CodeReviewIssue[], changedFiles: string[]): CodeReviewResult {
        let score = 100;
        let codeQuality = 100;
        let bestPractices = 100;
        let testing = 100;
        let documentation = 100;
        let security = 100;
        let performance = 100;

        const categoryCounts = {
            code_smell: 0,
            best_practice: 0,
            testing: 0,
            documentation: 0,
            security: 0,
            performance: 0
        };

        for (const issue of issues) {
            categoryCounts[issue.type]++;

            let penalty = 0;
            switch (issue.severity) {
                case 'critical': penalty = 20; break;
                case 'high': penalty = 10; break;
                case 'medium': penalty = 5; break;
                case 'low': penalty = 2; break;
            }

            score -= penalty;

            // Aplicar penalty específico por categoria
            switch (issue.type) {
                case 'code_smell': codeQuality -= penalty; break;
                case 'best_practice': bestPractices -= penalty; break;
                case 'testing': testing -= penalty; break;
                case 'documentation': documentation -= penalty; break;
                case 'security': security -= penalty * 1.5; break; // Security tem peso maior
                case 'performance': performance -= penalty; break;
            }
        }

        // Garantir que scores não sejam negativos
        score = Math.max(0, score);
        codeQuality = Math.max(0, codeQuality);
        bestPractices = Math.max(0, bestPractices);
        testing = Math.max(0, testing);
        documentation = Math.max(0, documentation);
        security = Math.max(0, security);
        performance = Math.max(0, performance);

        const recommendations: string[] = [];
        
        if (codeQuality < 80) {
            recommendations.push('Refatore códigos complexos e elimine duplicações');
        }
        if (security < 90) {
            recommendations.push('Corrija imediatamente os problemas de segurança identificados');
        }
        if (testing < 70) {
            recommendations.push('Adicione testes unitários para melhor cobertura');
        }
        if (documentation < 60) {
            recommendations.push('Melhore a documentação das funções públicas');
        }

        return {
            overallScore: Math.round(score),
            issues,
            summary: {
                totalIssues: issues.length,
                codeQuality: Math.round(codeQuality),
                bestPractices: Math.round(bestPractices),
                testing: Math.round(testing),
                documentation: Math.round(documentation),
                security: Math.round(security),
                performance: Math.round(performance)
            },
            recommendations,
            changedFiles,
            addedLines: 0, // Seria calculado via Git diff
            removedLines: 0 // Seria calculado via Git diff
        };
    }

    /**
     * Combina resultados de múltiplos arquivos
     */
    private combineReviewResults(results: CodeReviewResult[]): CodeReviewResult {
        if (results.length === 0) {
            return {
                overallScore: 100,
                issues: [],
                summary: {
                    totalIssues: 0,
                    codeQuality: 100,
                    bestPractices: 100,
                    testing: 100,
                    documentation: 100,
                    security: 100,
                    performance: 100
                },
                recommendations: [],
                changedFiles: [],
                addedLines: 0,
                removedLines: 0
            };
        }

        const allIssues = results.flatMap(r => r.issues);
        const allFiles = results.flatMap(r => r.changedFiles);

        // Calcular médias ponderadas
        const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
        const avgCodeQuality = results.reduce((sum, r) => sum + r.summary.codeQuality, 0) / results.length;
        const avgBestPractices = results.reduce((sum, r) => sum + r.summary.bestPractices, 0) / results.length;
        const avgTesting = results.reduce((sum, r) => sum + r.summary.testing, 0) / results.length;
        const avgDocumentation = results.reduce((sum, r) => sum + r.summary.documentation, 0) / results.length;
        const avgSecurity = results.reduce((sum, r) => sum + r.summary.security, 0) / results.length;
        const avgPerformance = results.reduce((sum, r) => sum + r.summary.performance, 0) / results.length;

        const allRecommendations = [...new Set(results.flatMap(r => r.recommendations))];

        return {
            overallScore: Math.round(avgScore),
            issues: allIssues,
            summary: {
                totalIssues: allIssues.length,
                codeQuality: Math.round(avgCodeQuality),
                bestPractices: Math.round(avgBestPractices),
                testing: Math.round(avgTesting),
                documentation: Math.round(avgDocumentation),
                security: Math.round(avgSecurity),
                performance: Math.round(avgPerformance)
            },
            recommendations: allRecommendations,
            changedFiles: [...new Set(allFiles)],
            addedLines: results.reduce((sum, r) => sum + r.addedLines, 0),
            removedLines: results.reduce((sum, r) => sum + r.removedLines, 0)
        };
    }

    /**
     * Exibe resultados do review
     */
    private async showReviewResults(result: CodeReviewResult): Promise<void> {
        const severityCount = {
            critical: result.issues.filter(i => i.severity === 'critical').length,
            high: result.issues.filter(i => i.severity === 'high').length,
            medium: result.issues.filter(i => i.severity === 'medium').length,
            low: result.issues.filter(i => i.severity === 'low').length
        };

        const scoreColor = result.overallScore >= 90 ? '🟢' : 
                          result.overallScore >= 70 ? '🟡' : '🔴';

        const message = `**xCopilot Code Review** ${scoreColor}

**Score Geral: ${result.overallScore}/100**

**Resumo:**
- 🔍 Qualidade: ${result.summary.codeQuality}/100
- 📋 Best Practices: ${result.summary.bestPractices}/100  
- 🧪 Testes: ${result.summary.testing}/100
- 📚 Documentação: ${result.summary.documentation}/100
- 🔒 Segurança: ${result.summary.security}/100
- ⚡ Performance: ${result.summary.performance}/100

**Issues Encontradas: ${result.issues.length}**
- ❌ Críticas: ${severityCount.critical}
- 🔴 Altas: ${severityCount.high}
- 🟡 Médias: ${severityCount.medium}
- 🟢 Baixas: ${severityCount.low}

**Arquivos Analisados: ${result.changedFiles.length}**`;

        const action = await vscode.window.showInformationMessage(
            message,
            'Ver Detalhes',
            'Exportar Report',
            'Fechar'
        );

        if (action === 'Ver Detalhes') {
            await this.showDetailedResults(result);
        } else if (action === 'Exportar Report') {
            await this.exportReviewReport(result);
        }
    }

    /**
     * Exibe resultados detalhados
     */
    private async showDetailedResults(result: CodeReviewResult): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content: this.formatDetailedReport(result),
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    /**
     * Formata report detalhado
     */
    private formatDetailedReport(result: CodeReviewResult): string {
        let report = `# xCopilot Code Review Report\n\n`;
        report += `**Score Geral: ${result.overallScore}/100**\n\n`;
        
        report += `## 📊 Resumo por Categoria\n\n`;
        report += `| Categoria | Score | Status |\n`;
        report += `|-----------|-------|--------|\n`;
        report += `| Qualidade de Código | ${result.summary.codeQuality}/100 | ${result.summary.codeQuality >= 80 ? '✅' : '❌'} |\n`;
        report += `| Best Practices | ${result.summary.bestPractices}/100 | ${result.summary.bestPractices >= 80 ? '✅' : '❌'} |\n`;
        report += `| Testes | ${result.summary.testing}/100 | ${result.summary.testing >= 70 ? '✅' : '❌'} |\n`;
        report += `| Documentação | ${result.summary.documentation}/100 | ${result.summary.documentation >= 60 ? '✅' : '❌'} |\n`;
        report += `| Segurança | ${result.summary.security}/100 | ${result.summary.security >= 90 ? '✅' : '❌'} |\n`;
        report += `| Performance | ${result.summary.performance}/100 | ${result.summary.performance >= 80 ? '✅' : '❌'} |\n\n`;

        if (result.recommendations.length > 0) {
            report += `## 💡 Recomendações\n\n`;
            for (const rec of result.recommendations) {
                report += `- ${rec}\n`;
            }
            report += `\n`;
        }

        if (result.issues.length > 0) {
            report += `## 🐛 Issues Encontradas\n\n`;
            
            const groupedIssues = result.issues.reduce((groups, issue) => {
                const key = issue.type;
                if (!groups[key]) groups[key] = [];
                groups[key].push(issue);
                return groups;
            }, {} as Record<string, CodeReviewIssue[]>);

            for (const [type, issues] of Object.entries(groupedIssues)) {
                const typeLabel = this.getTypeLabel(type);
                report += `### ${typeLabel}\n\n`;
                
                for (const issue of issues) {
                    const severityIcon = this.getSeverityIcon(issue.severity);
                    const location = issue.line ? `:${issue.line}` : '';
                    report += `${severityIcon} **${issue.file}${location}**\n`;
                    report += `- ${issue.message}\n`;
                    report += `- 💡 ${issue.suggestion}\n\n`;
                }
            }
        }

        report += `## 📁 Arquivos Analisados\n\n`;
        for (const file of result.changedFiles) {
            report += `- ${file}\n`;
        }

        return report;
    }

    /**
     * Exporta report para arquivo
     */
    private async exportReviewReport(result: CodeReviewResult): Promise<void> {
        const content = this.formatDetailedReport(result);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `xcopilot-review-${timestamp}.md`;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
                vscode.window.showInformationMessage(`Report exportado: ${fileName}`);
                
                const action = await vscode.window.showInformationMessage(
                    'Report salvo com sucesso!',
                    'Abrir Arquivo'
                );
                
                if (action === 'Abrir Arquivo') {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                }
            }
        } catch (error) {
            Logger.error('Error exporting review report:', error);
            vscode.window.showErrorMessage('Erro ao exportar report: ' + (error as Error).message);
        }
    }

    /**
     * Gera summary usando IA
     */
    private async generateAISummary(gitInfo: any): Promise<string> {
        try {
            const prompt = `Analise as seguintes mudanças de código e gere um summary de code review:

Branch: ${gitInfo?.currentBranch || 'unknown'}
Arquivos modificados: ${gitInfo?.changedFiles?.length || 0}
Tem mudanças não commitadas: ${gitInfo?.hasUncommittedChanges ? 'Sim' : 'Não'}

Gere um summary destacando:
- Principais mudanças identificadas
- Possíveis impactos
- Recomendações de review
- Score estimado (0-100)`;

            const response = await this.backendService.sendRequest(prompt, {});
            return response.response || response.resposta || 'Erro ao gerar summary';
        } catch (error) {
            Logger.error('Error generating AI summary:', error);
            return 'Erro ao gerar summary com IA';
        }
    }

    /**
     * Exibe summary
     */
    private async showSummary(summary: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content: `# xCopilot Review Summary\n\n${summary}`,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    // Helper methods
    private async openDocument(filePath: string): Promise<vscode.TextDocument | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            return await vscode.workspace.openTextDocument(uri);
        } catch (error) {
            Logger.warn('Could not open document:', filePath, error);
            return null;
        }
    }

    private isFunctionStart(line: string, language: string): boolean {
        const patterns = {
            javascript: /^\s*(function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+|\w+\s*\([^)]*\)\s*{)/,
            typescript: /^\s*(function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+|\w+\s*\([^)]*\)\s*{|public\s+\w+|private\s+\w+)/,
            python: /^\s*(def\s+\w+|class\s+\w+)/,
            java: /^\s*(public|private|protected).*\w+\s*\([^)]*\)\s*{/,
            csharp: /^\s*(public|private|protected).*\w+\s*\([^)]*\)\s*{/
        };
        
        const pattern = patterns[language as keyof typeof patterns] || patterns.javascript;
        return pattern.test(line);
    }

    private isPublicFunction(line: string, language: string): boolean {
        const patterns = {
            javascript: /^\s*(export\s+)?(function\s+\w+|const\s+\w+\s*=\s*\()/,
            typescript: /^\s*(export\s+)?(function\s+\w+|const\s+\w+\s*=\s*\(|public\s+\w+)/,
            python: /^\s*def\s+\w+/,
            java: /^\s*public.*\w+\s*\([^)]*\)\s*{/,
            csharp: /^\s*public.*\w+\s*\([^)]*\)\s*{/
        };
        
        const pattern = patterns[language as keyof typeof patterns] || patterns.javascript;
        return pattern.test(line);
    }

    private isCodeDuplication(lines: string[], currentIndex: number): boolean {
        const currentLine = lines[currentIndex].trim();
        if (currentLine.length < 10) return false; // Ignore short lines
        
        // Check for identical lines within a reasonable distance
        for (let i = Math.max(0, currentIndex - 20); i < Math.min(lines.length, currentIndex + 20); i++) {
            if (i !== currentIndex && lines[i].trim() === currentLine) {
                return true;
            }
        }
        return false;
    }

    private getTypeLabel(type: string): string {
        const labels = {
            code_smell: '🦨 Code Smells',
            best_practice: '📋 Best Practices',
            testing: '🧪 Testing',
            documentation: '📚 Documentation',
            security: '🔒 Security',
            performance: '⚡ Performance'
        };
        return labels[type as keyof typeof labels] || type;
    }

    private getSeverityIcon(severity: string): string {
        const icons = {
            critical: '❌',
            high: '🔴', 
            medium: '🟡',
            low: '🟢'
        };
        return icons[severity as keyof typeof icons] || '⚪';
    }
}