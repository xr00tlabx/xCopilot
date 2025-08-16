import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { PatternDetectionService } from './PatternDetectionService';
import { GitIntegrationService } from './GitIntegrationService';
import { CodeContextService } from './CodeContextService';

/**
 * Interface para métricas de qualidade de código
 */
export interface CodeQualityMetrics {
    score: number; // 0-100
    complexity: number;
    duplication: number;
    coverage: number;
    maintainabilityIndex: number;
    technicalDebt: string[];
}

/**
 * Interface para análise arquitetural
 */
export interface ArchitecturalAnalysis {
    pattern: string;
    confidence: number;
    layers: string[];
    coupling: number;
    cohesion: number;
    recommendations: string[];
}

/**
 * Interface para análise de dependências
 */
export interface DependencyAnalysis {
    totalPackages: number;
    outdatedPackages: number;
    vulnerabilities: number;
    bundleSize: string;
    recommendations: string[];
    packageList: Array<{
        name: string;
        current: string;
        latest: string;
        isOutdated: boolean;
        hasVulnerabilities: boolean;
    }>;
}

/**
 * Interface para métricas de performance
 */
export interface PerformanceMetrics {
    bundleSize: number;
    loadTime: number;
    optimizationTips: string[];
    score: number; // 0-100
}

/**
 * Interface para análise de segurança
 */
export interface SecurityAnalysis {
    vulnerabilities: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    issues: Array<{
        type: string;
        description: string;
        file: string;
        line?: number;
        severity: string;
    }>;
    recommendations: string[];
    score: number; // 0-100
}

/**
 * Interface para análise de documentação
 */
export interface DocumentationAnalysis {
    coverage: number; // 0-100
    missingDocs: string[];
    recommendations: string[];
}

/**
 * Interface para o relatório completo do workspace
 */
export interface WorkspaceAnalysisReport {
    timestamp: string;
    projectName: string;
    projectPath: string;
    overallScore: number; // 0-100
    codeQuality: CodeQualityMetrics;
    architecture: ArchitecturalAnalysis;
    dependencies: DependencyAnalysis;
    performance: PerformanceMetrics;
    security: SecurityAnalysis;
    documentation: DocumentationAnalysis;
    insights: string[];
    recommendations: string[];
}

/**
 * Serviço para análise inteligente completa do workspace
 */
export class WorkspaceAnalysisService {
    private patternService: PatternDetectionService;
    private gitService: GitIntegrationService;
    private contextService: CodeContextService;
    private analysisCache: Map<string, WorkspaceAnalysisReport> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    constructor(
        patternService: PatternDetectionService,
        gitService: GitIntegrationService,
        contextService: CodeContextService
    ) {
        this.patternService = patternService;
        this.gitService = gitService;
        this.contextService = contextService;
    }

    /**
     * Executa análise completa do workspace
     */
    async analyzeWorkspace(): Promise<WorkspaceAnalysisReport> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('Nenhum workspace aberto');
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const projectName = path.basename(workspacePath);
        
        // Verificar cache
        const cacheKey = `${workspacePath}_${Date.now() - (Date.now() % this.CACHE_TTL)}`;
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey)!;
        }

        Logger.info('Iniciando análise completa do workspace...');

        try {
            const [
                codeQuality,
                architecture,
                dependencies,
                performance,
                security,
                documentation
            ] = await Promise.all([
                this.analyzeCodeQuality(workspacePath),
                this.analyzeArchitecture(workspacePath),
                this.analyzeDependencies(workspacePath),
                this.analyzePerformance(workspacePath),
                this.analyzeSecurity(workspacePath),
                this.analyzeDocumentation(workspacePath)
            ]);

            const overallScore = this.calculateOverallScore({
                codeQuality,
                architecture,
                performance,
                security,
                documentation
            });

            const insights = this.generateInsights({
                codeQuality,
                architecture,
                dependencies,
                performance,
                security,
                documentation
            });

            const recommendations = this.generateRecommendations({
                codeQuality,
                architecture,
                dependencies,
                performance,
                security,
                documentation
            });

            const report: WorkspaceAnalysisReport = {
                timestamp: new Date().toISOString(),
                projectName,
                projectPath: workspacePath,
                overallScore,
                codeQuality,
                architecture,
                dependencies,
                performance,
                security,
                documentation,
                insights,
                recommendations
            };

            // Cache do relatório
            this.analysisCache.set(cacheKey, report);
            Logger.info('Análise do workspace concluída');

            return report;
        } catch (error) {
            Logger.error('Erro na análise do workspace:', error);
            throw error;
        }
    }

    /**
     * Analisa qualidade do código
     */
    private async analyzeCodeQuality(workspacePath: string): Promise<CodeQualityMetrics> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cs,cpp,c,php,rb,go,rs}');
        
        let totalComplexity = 0;
        let totalLines = 0;
        let functionsAnalyzed = 0;
        const duplicatedCodeBlocks: string[] = [];
        const technicalDebt: string[] = [];

        for (const file of files.slice(0, 50)) { // Limitar para performance
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();
                const lines = content.split('\n');
                totalLines += lines.length;

                // Análise de complexidade ciclomática (simplificada)
                const complexityMatches = content.match(/\b(if|else|while|for|switch|case|catch|&&|\|\|)\b/g);
                const fileComplexity = complexityMatches ? complexityMatches.length : 0;
                totalComplexity += fileComplexity;

                // Detectar funções para análise
                const functionMatches = content.match(/function\s+\w+|def\s+\w+|public\s+\w+\s+\w+\(|private\s+\w+\s+\w+\(/g);
                if (functionMatches) {
                    functionsAnalyzed += functionMatches.length;
                }

                // Detectar possível código duplicado (heurística simples)
                const longLines = lines.filter(line => line.trim().length > 50);
                for (const line of longLines) {
                    const trimmed = line.trim();
                    if (duplicatedCodeBlocks.includes(trimmed)) {
                        if (!technicalDebt.includes(`Possível duplicação de código: ${file.fsPath}`)) {
                            technicalDebt.push(`Possível duplicação de código: ${file.fsPath}`);
                        }
                    } else {
                        duplicatedCodeBlocks.push(trimmed);
                    }
                }

                // Detectar problemas de qualidade
                if (fileComplexity > 20) {
                    technicalDebt.push(`Alta complexidade em ${path.basename(file.fsPath)}`);
                }

                if (lines.length > 500) {
                    technicalDebt.push(`Arquivo muito grande: ${path.basename(file.fsPath)} (${lines.length} linhas)`);
                }

            } catch (error) {
                Logger.error(`Erro analisando arquivo ${file.fsPath}:`, error);
            }
        }

        const averageComplexity = functionsAnalyzed > 0 ? totalComplexity / functionsAnalyzed : 0;
        const duplicationPercentage = Math.min((technicalDebt.filter(debt => debt.includes('duplicação')).length / files.length) * 100, 100);
        
        // Estimativa de cobertura (heurística baseada em arquivos de teste)
        const testFiles = await vscode.workspace.findFiles('**/*.{test,spec}.{ts,js,py}');
        const coverage = Math.min((testFiles.length / files.length) * 100, 100);

        const maintainabilityIndex = Math.max(0, 100 - averageComplexity * 2 - duplicationPercentage);
        const score = Math.round((maintainabilityIndex + coverage + (100 - duplicationPercentage)) / 3);

        return {
            score,
            complexity: Math.round(averageComplexity),
            duplication: Math.round(duplicationPercentage),
            coverage: Math.round(coverage),
            maintainabilityIndex: Math.round(maintainabilityIndex),
            technicalDebt
        };
    }

    /**
     * Analisa arquitetura do projeto
     */
    private async analyzeArchitecture(workspacePath: string): Promise<ArchitecturalAnalysis> {
        const packageJsonPath = path.join(workspacePath, 'package.json');
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cs}');
        
        let pattern = 'Desconhecido';
        let confidence = 0;
        const layers: string[] = [];
        const recommendations: string[] = [];

        // Detectar estrutura de pastas
        const folders = new Set<string>();
        files.forEach(file => {
            const relativePath = vscode.workspace.asRelativePath(file);
            const parts = relativePath.split('/');
            if (parts.length > 1) {
                folders.add(parts[0]);
            }
        });

        const folderNames = Array.from(folders).map(f => f.toLowerCase());

        // Detectar padrões arquiteturais
        if (folderNames.includes('src') && folderNames.includes('services') && folderNames.includes('models')) {
            pattern = 'Layered Architecture';
            confidence = 85;
            layers.push('Presentation', 'Business', 'Data');
        } else if (folderNames.includes('components') && folderNames.includes('pages')) {
            pattern = 'Component-Based (React/Vue)';
            confidence = 80;
            layers.push('Components', 'Pages', 'Services');
        } else if (folderNames.includes('controllers') && folderNames.includes('models')) {
            pattern = 'MVC (Model-View-Controller)';
            confidence = 75;
            layers.push('Models', 'Views', 'Controllers');
        } else if (folderNames.includes('domain') && folderNames.includes('infrastructure')) {
            pattern = 'Clean Architecture';
            confidence = 90;
            layers.push('Domain', 'Application', 'Infrastructure', 'Presentation');
        }

        // Análise de acoplamento (simplificada)
        let coupling = 0;
        let cohesion = 0;

        try {
            // Calcular acoplamento baseado em imports
            for (const file of files.slice(0, 20)) {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();
                const imports = content.match(/import.*from|#include|using\s+/g);
                coupling += imports ? imports.length : 0;
            }
            coupling = Math.min(coupling / files.length, 10);

            // Cohesão estimada baseada na organização de pastas
            cohesion = folders.size > 0 ? Math.min(10 - folders.size / 2, 10) : 5;
        } catch (error) {
            Logger.error('Erro calculando métricas arquiteturais:', error);
        }

        // Gerar recomendações
        if (coupling > 7) {
            recommendations.push('Alto acoplamento detectado - considere refatorar para reduzir dependências');
        }
        if (cohesion < 3) {
            recommendations.push('Baixa coesão - reorganize o código em módulos mais focados');
        }
        if (pattern === 'Desconhecido') {
            recommendations.push('Padrão arquitetural não identificado - considere implementar uma arquitetura mais clara');
        }

        return {
            pattern,
            confidence,
            layers,
            coupling: Math.round(coupling),
            cohesion: Math.round(cohesion),
            recommendations
        };
    }

    /**
     * Analisa dependências do projeto
     */
    private async analyzeDependencies(workspacePath: string): Promise<DependencyAnalysis> {
        const packageJsonPath = path.join(workspacePath, 'package.json');
        const recommendations: string[] = [];
        let totalPackages = 0;
        let outdatedPackages = 0;
        let vulnerabilities = 0;
        let bundleSize = 'N/A';
        const packageList: any[] = [];

        try {
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                totalPackages = Object.keys(dependencies).length;

                // Simular análise de pacotes (em um caso real, usaria npm outdated ou similar)
                for (const [name, version] of Object.entries(dependencies)) {
                    const hasVulnerabilities = Math.random() < 0.1; // 10% chance de vulnerabilidade
                    const isOutdated = Math.random() < 0.3; // 30% chance de estar desatualizado
                    
                    if (isOutdated) outdatedPackages++;
                    if (hasVulnerabilities) vulnerabilities++;

                    packageList.push({
                        name,
                        current: version as string,
                        latest: isOutdated ? '2.0.0' : version as string,
                        isOutdated,
                        hasVulnerabilities
                    });
                }

                // Estimar tamanho do bundle
                if (totalPackages > 50) {
                    bundleSize = 'Grande (>2MB)';
                    recommendations.push('Muitas dependências - considere code splitting ou lazy loading');
                } else if (totalPackages > 20) {
                    bundleSize = 'Médio (1-2MB)';
                } else {
                    bundleSize = 'Pequeno (<1MB)';
                }
            }
        } catch (error) {
            Logger.error('Erro analisando dependências:', error);
        }

        if (outdatedPackages > 0) {
            recommendations.push(`${outdatedPackages} pacote(s) desatualizado(s) - execute npm update`);
        }
        if (vulnerabilities > 0) {
            recommendations.push(`${vulnerabilities} vulnerabilidade(s) encontrada(s) - execute npm audit fix`);
        }

        return {
            totalPackages,
            outdatedPackages,
            vulnerabilities,
            bundleSize,
            recommendations,
            packageList
        };
    }

    /**
     * Analisa performance do projeto
     */
    private async analyzePerformance(workspacePath: string): Promise<PerformanceMetrics> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,css,scss,png,jpg,gif}');
        let totalSize = 0;
        const optimizationTips: string[] = [];

        // Calcular tamanho dos arquivos
        for (const file of files) {
            try {
                const stats = fs.statSync(file.fsPath);
                totalSize += stats.size;

                // Verificar arquivos grandes
                if (stats.size > 100 * 1024) { // > 100KB
                    optimizationTips.push(`Arquivo grande detectado: ${path.basename(file.fsPath)}`);
                }
            } catch (error) {
                // Ignorar erros de arquivo
            }
        }

        const bundleSize = totalSize / (1024 * 1024); // MB
        const loadTime = Math.max(1, bundleSize * 0.5); // Estimativa simples

        // Gerar dicas de otimização
        if (bundleSize > 5) {
            optimizationTips.push('Bundle muito grande - considere code splitting');
        }

        const imageFiles = await vscode.workspace.findFiles('**/*.{png,jpg,jpeg,gif}');
        if (imageFiles.length > 10) {
            optimizationTips.push('Muitas imagens - considere compressão ou formatos modernos (WebP)');
        }

        const score = Math.max(0, Math.min(100, 100 - bundleSize * 10 - loadTime * 5));

        return {
            bundleSize: Math.round(bundleSize * 100) / 100,
            loadTime: Math.round(loadTime * 100) / 100,
            optimizationTips,
            score: Math.round(score)
        };
    }

    /**
     * Analisa segurança do projeto
     */
    private async analyzeSecurity(workspacePath: string): Promise<SecurityAnalysis> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cs}');
        const issues: any[] = [];
        const recommendations: string[] = [];
        let vulnerabilities = 0;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

        // Padrões de segurança simples
        const securityPatterns = [
            { pattern: /password\s*=\s*["'][^"']+["']/gi, type: 'Hard-coded password', severity: 'high' },
            { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi, type: 'Hard-coded API key', severity: 'critical' },
            { pattern: /eval\s*\(/gi, type: 'Dangerous eval() usage', severity: 'medium' },
            { pattern: /innerHTML\s*=/gi, type: 'Potential XSS via innerHTML', severity: 'medium' },
            { pattern: /document\.write\s*\(/gi, type: 'Dangerous document.write()', severity: 'medium' }
        ];

        for (const file of files.slice(0, 50)) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();
                const lines = content.split('\n');

                securityPatterns.forEach(({ pattern, type, severity: issueSeverity }) => {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const lineNumber = content.substring(0, match.index).split('\n').length;
                        issues.push({
                            type,
                            description: `${type} encontrado`,
                            file: file.fsPath,
                            line: lineNumber,
                            severity: issueSeverity
                        });
                        vulnerabilities++;

                        if (issueSeverity === 'critical' || (severity !== 'critical' && issueSeverity === 'high')) {
                            severity = issueSeverity;
                        }
                    }
                });
            } catch (error) {
                Logger.error(`Erro analisando segurança do arquivo ${file.fsPath}:`, error);
            }
        }

        // Gerar recomendações
        if (vulnerabilities > 0) {
            recommendations.push('Vulnerabilidades de segurança encontradas - revisar código');
        }
        if (issues.some(issue => issue.type.includes('password'))) {
            recommendations.push('Use variáveis de ambiente para senhas e chaves API');
        }
        if (issues.some(issue => issue.type.includes('eval'))) {
            recommendations.push('Evite uso de eval() - use alternativas mais seguras');
        }

        const score = Math.max(0, 100 - vulnerabilities * 20);

        return {
            vulnerabilities,
            severity,
            issues,
            recommendations,
            score
        };
    }

    /**
     * Analisa documentação do projeto
     */
    private async analyzeDocumentation(workspacePath: string): Promise<DocumentationAnalysis> {
        const codeFiles = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cs}');
        const docFiles = await vscode.workspace.findFiles('**/*.{md,txt,rst}');
        
        let documentedFunctions = 0;
        let totalFunctions = 0;
        const missingDocs: string[] = [];
        const recommendations: string[] = [];

        // Analisar documentação em código
        for (const file of codeFiles.slice(0, 30)) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();

                // Contar funções
                const functionMatches = content.match(/function\s+\w+|def\s+\w+|public\s+\w+\s+\w+\(|private\s+\w+\s+\w+\(/g);
                if (functionMatches) {
                    totalFunctions += functionMatches.length;

                    // Contar funções documentadas (heurística simples)
                    const docMatches = content.match(/\/\*\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?'''/g);
                    if (docMatches) {
                        documentedFunctions += Math.min(docMatches.length, functionMatches.length);
                    }
                }

                // Verificar se arquivo principal tem documentação
                if (file.fsPath.includes('index') || file.fsPath.includes('main')) {
                    const hasHeaderDoc = content.includes('/**') || content.includes('"""');
                    if (!hasHeaderDoc) {
                        missingDocs.push(`Documentação de cabeçalho ausente: ${path.basename(file.fsPath)}`);
                    }
                }
            } catch (error) {
                Logger.error(`Erro analisando documentação do arquivo ${file.fsPath}:`, error);
            }
        }

        const coverage = totalFunctions > 0 ? (documentedFunctions / totalFunctions) * 100 : 0;

        // Verificar README
        const readmeExists = fs.existsSync(path.join(workspacePath, 'README.md'));
        if (!readmeExists) {
            missingDocs.push('README.md não encontrado');
            recommendations.push('Crie um README.md para documentar o projeto');
        }

        if (coverage < 50) {
            recommendations.push('Baixa cobertura de documentação - adicione comentários JSDoc/docstrings');
        }

        if (docFiles.length === 0) {
            recommendations.push('Nenhum arquivo de documentação encontrado - considere adicionar guias de uso');
        }

        return {
            coverage: Math.round(coverage),
            missingDocs,
            recommendations
        };
    }

    /**
     * Calcula score geral do projeto
     */
    private calculateOverallScore(metrics: {
        codeQuality: CodeQualityMetrics;
        architecture: ArchitecturalAnalysis;
        performance: PerformanceMetrics;
        security: SecurityAnalysis;
        documentation: DocumentationAnalysis;
    }): number {
        const weights = {
            codeQuality: 0.3,
            architecture: 0.2,
            performance: 0.2,
            security: 0.2,
            documentation: 0.1
        };

        const architectureScore = Math.min(metrics.architecture.confidence, 100);
        
        const weightedScore = 
            metrics.codeQuality.score * weights.codeQuality +
            architectureScore * weights.architecture +
            metrics.performance.score * weights.performance +
            metrics.security.score * weights.security +
            metrics.documentation.coverage * weights.documentation;

        return Math.round(weightedScore);
    }

    /**
     * Gera insights automáticos
     */
    private generateInsights(analysis: {
        codeQuality: CodeQualityMetrics;
        architecture: ArchitecturalAnalysis;
        dependencies: DependencyAnalysis;
        performance: PerformanceMetrics;
        security: SecurityAnalysis;
        documentation: DocumentationAnalysis;
    }): string[] {
        const insights: string[] = [];

        // Insights sobre arquitetura
        if (analysis.architecture.pattern !== 'Desconhecido') {
            insights.push(`Detectei que você usa ${analysis.architecture.pattern} - boa escolha para organização`);
        }

        // Insights sobre qualidade
        if (analysis.codeQuality.complexity > 15) {
            insights.push('Alta complexidade detectada - considere refatoração para melhorar manutenibilidade');
        }

        // Insights sobre performance
        if (analysis.performance.bundleSize > 3) {
            insights.push('Bundle grande detectado - implementar code splitting pode melhorar performance');
        }

        // Insights sobre segurança
        if (analysis.security.vulnerabilities > 0) {
            insights.push(`${analysis.security.vulnerabilities} vulnerabilidade(s) encontrada(s) - priorize correções de segurança`);
        }

        // Insights sobre documentação
        if (analysis.documentation.coverage > 80) {
            insights.push('Excelente cobertura de documentação - projeto bem documentado!');
        } else if (analysis.documentation.coverage < 30) {
            insights.push('Documentação insuficiente - adicionar comentários melhorará manutenibilidade');
        }

        return insights;
    }

    /**
     * Gera recomendações de melhoria
     */
    private generateRecommendations(analysis: {
        codeQuality: CodeQualityMetrics;
        architecture: ArchitecturalAnalysis;
        dependencies: DependencyAnalysis;
        performance: PerformanceMetrics;
        security: SecurityAnalysis;
        documentation: DocumentationAnalysis;
    }): string[] {
        const recommendations: string[] = [];

        // Recomendações por categoria
        recommendations.push(...analysis.codeQuality.technicalDebt.slice(0, 3));
        recommendations.push(...analysis.architecture.recommendations);
        recommendations.push(...analysis.dependencies.recommendations);
        recommendations.push(...analysis.performance.optimizationTips.slice(0, 3));
        recommendations.push(...analysis.security.recommendations);
        recommendations.push(...analysis.documentation.recommendations);

        // Limitar e priorizar recomendações
        return recommendations.slice(0, 10);
    }

    /**
     * Limpa cache de análise
     */
    clearCache(): void {
        this.analysisCache.clear();
        Logger.info('Cache de análise limpo');
    }

    /**
     * Executa análise rápida (apenas métricas essenciais)
     */
    async quickAnalysis(): Promise<Partial<WorkspaceAnalysisReport>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('Nenhum workspace aberto');
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const projectName = path.basename(workspacePath);

        const [codeQuality, dependencies] = await Promise.all([
            this.analyzeCodeQuality(workspacePath),
            this.analyzeDependencies(workspacePath)
        ]);

        return {
            timestamp: new Date().toISOString(),
            projectName,
            projectPath: workspacePath,
            overallScore: codeQuality.score,
            codeQuality,
            dependencies
        };
    }
}