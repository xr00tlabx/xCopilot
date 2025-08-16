import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { CodeContextService } from './CodeContextService';

/**
 * Serviço para análise completa do workspace e geração de contexto
 */
export class WorkspaceAnalysisService {
    private static instance: WorkspaceAnalysisService;
    private contextService: CodeContextService;
    private workspaceState: WorkspaceState | null = null;
    private analysisInProgress = false;
    private lastAnalysisTime = 0;
    private readonly ANALYSIS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    private constructor() {
        this.contextService = CodeContextService.getInstance();
        this.setupWorkspaceListeners();
    }

    static getInstance(): WorkspaceAnalysisService {
        if (!WorkspaceAnalysisService.instance) {
            WorkspaceAnalysisService.instance = new WorkspaceAnalysisService();
        }
        return WorkspaceAnalysisService.instance;
    }

    /**
     * Configura listeners para mudanças no workspace
     */
    private setupWorkspaceListeners(): void {
        // Análise quando arquivos são criados/deletados
        vscode.workspace.onDidCreateFiles(() => {
            this.scheduleIncrementalAnalysis();
        });

        vscode.workspace.onDidDeleteFiles(() => {
            this.scheduleIncrementalAnalysis();
        });

        // Análise quando workspace folder muda
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.invalidateWorkspaceState();
            this.scheduleFullAnalysis();
        });
    }

    /**
     * Análise completa do workspace no startup
     */
    async analyzeWorkspaceOnStartup(): Promise<void> {
        if (this.analysisInProgress) {
            return;
        }

        Logger.info('🔍 Starting complete workspace analysis...');
        this.analysisInProgress = true;

        try {
            const workspaceState = await this.performFullAnalysis();
            this.workspaceState = workspaceState;
            this.lastAnalysisTime = Date.now();

            Logger.info(`✅ Workspace analysis completed: ${workspaceState.totalFiles} files, ${workspaceState.languages.length} languages`);
            
            // Show analysis results to user
            vscode.window.showInformationMessage(
                `xCopilot: Workspace analyzed (${workspaceState.totalFiles} files, ${workspaceState.languages.join(', ')})`
            );

        } catch (error) {
            Logger.error('Error during workspace analysis:', error);
        } finally {
            this.analysisInProgress = false;
        }
    }

    /**
     * Obtém contexto rico do workspace para chat
     */
    getWorkspaceContext(): WorkspaceContext {
        if (!this.workspaceState || this.isAnalysisStale()) {
            // Se não há análise ou está desatualizada, retornar contexto básico
            return this.getBasicWorkspaceContext();
        }

        return {
            projectType: this.workspaceState.projectType,
            mainLanguages: this.workspaceState.languages.slice(0, 3),
            structure: this.workspaceState.structure,
            keyFiles: this.workspaceState.keyFiles,
            technologies: this.workspaceState.technologies,
            patterns: this.workspaceState.patterns,
            currentFile: this.getCurrentFileInfo(),
            recentFiles: this.getRecentFiles(),
            summary: this.generateWorkspaceSummary()
        };
    }

    /**
     * Formata contexto do workspace para prompt
     */
    formatContextForPrompt(userPrompt: string): string {
        const context = this.getWorkspaceContext();
        
        let contextPrompt = `[WORKSPACE CONTEXT]\n`;
        
        if (context.projectType) {
            contextPrompt += `Project Type: ${context.projectType}\n`;
        }
        
        contextPrompt += `Languages: ${context.mainLanguages.join(', ')}\n`;
        
        if (context.technologies.length > 0) {
            contextPrompt += `Technologies: ${context.technologies.join(', ')}\n`;
        }
        
        if (context.currentFile) {
            contextPrompt += `Current File: ${context.currentFile.name} (${context.currentFile.language})\n`;
        }
        
        if (context.keyFiles.length > 0) {
            contextPrompt += `Key Files: ${context.keyFiles.slice(0, 5).join(', ')}\n`;
        }
        
        contextPrompt += `\n[USER QUESTION]\n${userPrompt}\n\n`;
        contextPrompt += `[INSTRUCTIONS]\nAnswer considering the workspace context above. Be specific to the project's technologies and structure.`;
        
        return contextPrompt;
    }

    /**
     * Análise completa do workspace
     */
    private async performFullAnalysis(): Promise<WorkspaceState> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const rootFolder = workspaceFolders[0];
        const files = await this.getAllFiles(rootFolder.uri);
        
        const analysis: WorkspaceState = {
            totalFiles: files.length,
            languages: this.extractLanguages(files),
            structure: await this.analyzeStructure(rootFolder.uri, files),
            keyFiles: this.identifyKeyFiles(files),
            technologies: await this.detectTechnologies(files),
            patterns: await this.detectPatterns(files),
            projectType: this.detectProjectType(files),
            lastUpdated: Date.now()
        };

        return analysis;
    }

    /**
     * Obtém todos os arquivos do workspace
     */
    private async getAllFiles(rootUri: vscode.Uri): Promise<FileInfo[]> {
        const pattern = '**/*.{js,ts,tsx,jsx,py,java,cpp,c,cs,php,go,rs,rb,swift,kt,scala,dart,vue,svelte,html,css,scss,sass,less,json,yaml,yml,md,txt}';
        const excludePattern = '**/node_modules/**';
        
        const files = await vscode.workspace.findFiles(pattern, excludePattern, 1000);
        
        const fileInfos: FileInfo[] = [];
        for (const file of files) {
            try {
                const stat = await vscode.workspace.fs.stat(file);
                const relativePath = vscode.workspace.asRelativePath(file);
                const extension = path.extname(file.fsPath);
                
                fileInfos.push({
                    uri: file,
                    relativePath,
                    name: path.basename(file.fsPath),
                    extension,
                    language: this.getLanguageFromExtension(extension),
                    size: stat.size,
                    lastModified: stat.mtime
                });
            } catch (error) {
                Logger.debug(`Could not stat file ${file.fsPath}:`, error);
            }
        }
        
        return fileInfos;
    }

    /**
     * Extrai linguagens dos arquivos
     */
    private extractLanguages(files: FileInfo[]): string[] {
        const languageCount = new Map<string, number>();
        
        files.forEach(file => {
            if (file.language) {
                languageCount.set(file.language, (languageCount.get(file.language) || 0) + 1);
            }
        });
        
        // Ordenar por frequência
        return Array.from(languageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
    }

    /**
     * Analisa estrutura do projeto
     */
    private async analyzeStructure(rootUri: vscode.Uri, files: FileInfo[]): Promise<ProjectStructure> {
        const folders = new Set<string>();
        const structure: ProjectStructure = {
            hasSourceFolder: false,
            hasTestFolder: false,
            mainFolders: [],
            depth: 0
        };
        
        files.forEach(file => {
            const parts = file.relativePath.split('/');
            if (parts.length > 1) {
                const folder = parts[0];
                folders.add(folder);
                structure.depth = Math.max(structure.depth, parts.length);
            }
        });
        
        structure.mainFolders = Array.from(folders).slice(0, 10);
        structure.hasSourceFolder = structure.mainFolders.some(f => 
            ['src', 'source', 'lib', 'app'].includes(f.toLowerCase())
        );
        structure.hasTestFolder = structure.mainFolders.some(f => 
            ['test', 'tests', '__tests__', 'spec', 'specs'].includes(f.toLowerCase())
        );
        
        return structure;
    }

    /**
     * Identifica arquivos-chave do projeto
     */
    private identifyKeyFiles(files: FileInfo[]): string[] {
        const keyFilePatterns = [
            'package.json', 'requirements.txt', 'pom.xml', 'build.gradle',
            'Cargo.toml', 'go.mod', 'composer.json', 'Gemfile',
            'index.js', 'index.ts', 'main.py', 'app.py', 'Main.java',
            'README.md', 'CHANGELOG.md', 'LICENSE', '.gitignore',
            'tsconfig.json', 'webpack.config.js', 'vite.config.js'
        ];
        
        return files
            .filter(file => keyFilePatterns.some(pattern => 
                file.name.toLowerCase().includes(pattern.toLowerCase())
            ))
            .map(file => file.relativePath)
            .slice(0, 10);
    }

    /**
     * Detecta tecnologias usando arquivos de configuração
     */
    private async detectTechnologies(files: FileInfo[]): Promise<string[]> {
        const technologies = new Set<string>();
        
        for (const file of files) {
            // Detectar por nome de arquivo
            if (file.name === 'package.json') {
                try {
                    const content = await vscode.workspace.fs.readFile(file.uri);
                    const packageJson = JSON.parse(content.toString());
                    
                    // Extrair tecnologias das dependências
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    Object.keys(deps).forEach(dep => {
                        if (dep.includes('react')) technologies.add('React');
                        if (dep.includes('vue')) technologies.add('Vue.js');
                        if (dep.includes('angular')) technologies.add('Angular');
                        if (dep.includes('express')) technologies.add('Express.js');
                        if (dep.includes('next')) technologies.add('Next.js');
                        if (dep.includes('nuxt')) technologies.add('Nuxt.js');
                        if (dep.includes('typescript')) technologies.add('TypeScript');
                        if (dep.includes('webpack')) technologies.add('Webpack');
                        if (dep.includes('vite')) technologies.add('Vite');
                    });
                } catch (error) {
                    Logger.debug('Error reading package.json:', error);
                }
            }
            
            // Detectar por extensão
            if (file.extension === '.tsx' || file.extension === '.jsx') {
                technologies.add('React');
            }
            if (file.extension === '.vue') {
                technologies.add('Vue.js');
            }
            if (file.extension === '.ts') {
                technologies.add('TypeScript');
            }
            if (file.name === 'requirements.txt') {
                technologies.add('Python');
            }
            if (file.name === 'pom.xml') {
                technologies.add('Maven');
            }
            if (file.name === 'build.gradle') {
                technologies.add('Gradle');
            }
        }
        
        return Array.from(technologies);
    }

    /**
     * Detecta padrões de código
     */
    private async detectPatterns(files: FileInfo[]): Promise<string[]> {
        // Esta é uma implementação simplificada
        // Em uma versão completa, analisaria o conteúdo dos arquivos
        const patterns: string[] = [];
        
        if (files.some(f => f.relativePath.includes('components/'))) {
            patterns.push('Component-based architecture');
        }
        if (files.some(f => f.relativePath.includes('services/'))) {
            patterns.push('Service layer pattern');
        }
        if (files.some(f => f.relativePath.includes('models/'))) {
            patterns.push('Model layer pattern');
        }
        if (files.some(f => f.relativePath.includes('controllers/'))) {
            patterns.push('MVC pattern');
        }
        
        return patterns;
    }

    /**
     * Detecta tipo de projeto
     */
    private detectProjectType(files: FileInfo[]): string {
        if (files.some(f => f.name === 'package.json')) {
            return 'Node.js/JavaScript';
        }
        if (files.some(f => f.name === 'requirements.txt' || f.name === 'setup.py')) {
            return 'Python';
        }
        if (files.some(f => f.name === 'pom.xml')) {
            return 'Java/Maven';
        }
        if (files.some(f => f.name === 'build.gradle')) {
            return 'Java/Gradle';
        }
        if (files.some(f => f.name === 'Cargo.toml')) {
            return 'Rust';
        }
        if (files.some(f => f.name === 'go.mod')) {
            return 'Go';
        }
        if (files.some(f => f.extension === '.csproj')) {
            return 'C#/.NET';
        }
        
        return 'Mixed/Other';
    }

    /**
     * Obtém linguagem pela extensão
     */
    private getLanguageFromExtension(extension: string): string | null {
        const extensionMap: { [key: string]: string } = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.go': 'Go',
            '.rs': 'Rust',
            '.rb': 'Ruby',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.dart': 'Dart',
            '.vue': 'Vue',
            '.svelte': 'Svelte'
        };
        
        return extensionMap[extension] || null;
    }

    /**
     * Obtém informações do arquivo atual
     */
    private getCurrentFileInfo(): CurrentFileInfo | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }
        
        const document = editor.document;
        return {
            name: path.basename(document.fileName),
            relativePath: vscode.workspace.asRelativePath(document.fileName),
            language: document.languageId,
            lineCount: document.lineCount
        };
    }

    /**
     * Obtém arquivos recentes
     */
    private getRecentFiles(): string[] {
        // Esta é uma implementação simplificada
        // Poderia usar vscode.workspace.onDidOpenTextDocument para rastrear
        const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        return tabs
            .filter(tab => tab.input instanceof vscode.TabInputText)
            .map(tab => vscode.workspace.asRelativePath((tab.input as vscode.TabInputText).uri))
            .slice(0, 5);
    }

    /**
     * Gera resumo do workspace
     */
    private generateWorkspaceSummary(): string {
        if (!this.workspaceState) {
            return 'No workspace analysis available';
        }
        
        const { totalFiles, languages, projectType, technologies } = this.workspaceState;
        
        let summary = `${projectType} project with ${totalFiles} files`;
        if (languages.length > 0) {
            summary += `, primarily ${languages[0]}`;
        }
        if (technologies.length > 0) {
            summary += `, using ${technologies.slice(0, 3).join(', ')}`;
        }
        
        return summary;
    }

    /**
     * Obtém contexto básico quando análise completa não está disponível
     */
    private getBasicWorkspaceContext(): WorkspaceContext {
        const currentFile = this.getCurrentFileInfo();
        const recentFiles = this.getRecentFiles();
        
        return {
            projectType: 'Unknown',
            mainLanguages: currentFile ? [currentFile.language] : [],
            structure: { hasSourceFolder: false, hasTestFolder: false, mainFolders: [], depth: 0 },
            keyFiles: [],
            technologies: [],
            patterns: [],
            currentFile,
            recentFiles,
            summary: 'Basic workspace context (analysis pending)'
        };
    }

    /**
     * Agenda análise incremental
     */
    private scheduleIncrementalAnalysis(): void {
        // Análise incremental em 5 segundos
        setTimeout(() => {
            if (!this.analysisInProgress) {
                this.performIncrementalAnalysis();
            }
        }, 5000);
    }

    /**
     * Agenda análise completa
     */
    private scheduleFullAnalysis(): void {
        setTimeout(() => {
            this.analyzeWorkspaceOnStartup();
        }, 2000);
    }

    /**
     * Análise incremental (mais leve)
     */
    private async performIncrementalAnalysis(): Promise<void> {
        if (!this.workspaceState) {
            return;
        }
        
        // Atualizar apenas informações básicas
        this.workspaceState.lastUpdated = Date.now();
        Logger.debug('Incremental workspace analysis completed');
    }

    /**
     * Invalida estado do workspace
     */
    private invalidateWorkspaceState(): void {
        this.workspaceState = null;
        this.lastAnalysisTime = 0;
    }

    /**
     * Verifica se análise está desatualizada
     */
    private isAnalysisStale(): boolean {
        return Date.now() - this.lastAnalysisTime > this.ANALYSIS_CACHE_TTL;
    }
}

// Interfaces
interface WorkspaceState {
    totalFiles: number;
    languages: string[];
    structure: ProjectStructure;
    keyFiles: string[];
    technologies: string[];
    patterns: string[];
    projectType: string;
    lastUpdated: number;
}

interface WorkspaceContext {
    projectType: string;
    mainLanguages: string[];
    structure: ProjectStructure;
    keyFiles: string[];
    technologies: string[];
    patterns: string[];
    currentFile: CurrentFileInfo | null;
    recentFiles: string[];
    summary: string;
}

interface ProjectStructure {
    hasSourceFolder: boolean;
    hasTestFolder: boolean;
    mainFolders: string[];
    depth: number;
}

interface FileInfo {
    uri: vscode.Uri;
    relativePath: string;
    name: string;
    extension: string;
    language: string | null;
    size: number;
    lastModified: number;
}

interface CurrentFileInfo {
    name: string;
    relativePath: string;
    language: string;
    lineCount: number;
}