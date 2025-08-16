import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { 
    WorkspaceAnalysis, 
    ProjectStructure, 
    DependencyInfo, 
    CodePattern, 
    ArchitectureInfo,
    FileTypeStats,
    DirectoryInfo,
    CodeStyleGuide
} from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para análise completa do workspace
 */
export class WorkspaceAnalysisService {
    private static instance: WorkspaceAnalysisService;
    private analysis: WorkspaceAnalysis | null = null;
    private analyzing = false;
    private readonly cacheKey = 'xcopilot.workspaceAnalysis';
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadCachedAnalysis();
    }

    static getInstance(context?: vscode.ExtensionContext): WorkspaceAnalysisService {
        if (!WorkspaceAnalysisService.instance && context) {
            WorkspaceAnalysisService.instance = new WorkspaceAnalysisService(context);
        }
        return WorkspaceAnalysisService.instance;
    }

    /**
     * Inicia análise completa do workspace
     */
    async analyzeWorkspace(force = false): Promise<WorkspaceAnalysis | null> {
        if (this.analyzing) {
            Logger.info('Workspace analysis already in progress');
            return this.analysis;
        }

        // Use cached analysis if available and recent (< 1 hour)
        if (!force && this.analysis && this.isAnalysisRecent()) {
            Logger.info('Using cached workspace analysis');
            return this.analysis;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            Logger.warn('No workspace folders found for analysis');
            return null;
        }

        this.analyzing = true;
        Logger.info('Starting workspace analysis...');

        try {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            
            const [
                projectStructure,
                dependencies,
                codePatterns,
                architecture,
                fileTypes
            ] = await Promise.all([
                this.analyzeProjectStructure(workspaceRoot),
                this.analyzeDependencies(workspaceRoot),
                this.analyzeCodePatterns(workspaceRoot),
                this.analyzeArchitecture(workspaceRoot),
                this.analyzeFileTypes(workspaceRoot)
            ]);

            this.analysis = {
                projectStructure,
                dependencies,
                codePatterns,
                architecture,
                fileTypes,
                lastAnalyzed: new Date()
            };

            this.saveAnalysis();
            Logger.info('Workspace analysis completed successfully');
            
            // Notify UI about completed analysis
            vscode.commands.executeCommand('setContext', 'xcopilot.workspaceAnalyzed', true);
            
            return this.analysis;

        } catch (error) {
            Logger.error('Error during workspace analysis:', error);
            return null;
        } finally {
            this.analyzing = false;
        }
    }

    /**
     * Obtém análise atual (pode ser null se não feita ainda)
     */
    getCurrentAnalysis(): WorkspaceAnalysis | null {
        return this.analysis;
    }

    /**
     * Verifica se a análise precisa ser atualizada
     */
    needsUpdate(): boolean {
        return !this.analysis || !this.isAnalysisRecent();
    }

    /**
     * Analisa estrutura do projeto
     */
    private async analyzeProjectStructure(workspaceRoot: string): Promise<ProjectStructure> {
        const structure: ProjectStructure = {
            totalFiles: 0,
            totalLines: 0,
            directories: [],
            mainFiles: [],
            configFiles: [],
            testFiles: []
        };

        const excludePatterns = [
            /node_modules/,
            /\.git/,
            /dist/,
            /build/,
            /\.vscode/,
            /coverage/,
            /\.next/,
            /\.nuxt/,
            /target/,
            /bin/,
            /obj/
        ];

        await this.walkDirectory(workspaceRoot, workspaceRoot, structure, excludePatterns);
        
        return structure;
    }

    /**
     * Percorre diretório recursivamente
     */
    private async walkDirectory(
        dirPath: string, 
        rootPath: string, 
        structure: ProjectStructure,
        excludePatterns: RegExp[]
    ): Promise<void> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const relativePath = path.relative(rootPath, dirPath);
            
            if (excludePatterns.some(pattern => pattern.test(relativePath))) {
                return;
            }

            const directoryInfo: DirectoryInfo = {
                path: relativePath || '.',
                fileCount: 0,
                subDirectories: [],
                purpose: this.inferDirectoryPurpose(relativePath)
            };

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativeFilePath = path.relative(rootPath, fullPath);

                if (excludePatterns.some(pattern => pattern.test(relativeFilePath))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    directoryInfo.subDirectories.push(entry.name);
                    await this.walkDirectory(fullPath, rootPath, structure, excludePatterns);
                } else if (entry.isFile()) {
                    directoryInfo.fileCount++;
                    structure.totalFiles++;

                    // Count lines
                    try {
                        const content = await fs.promises.readFile(fullPath, 'utf8');
                        structure.totalLines += content.split('\n').length;
                    } catch (error) {
                        // Skip binary or unreadable files
                    }

                    // Categorize files
                    this.categorizeFile(relativeFilePath, structure);
                }
            }

            if (directoryInfo.fileCount > 0 || directoryInfo.subDirectories.length > 0) {
                structure.directories.push(directoryInfo);
            }

        } catch (error) {
            Logger.warn(`Error reading directory ${dirPath}:`, error);
        }
    }

    /**
     * Infere propósito do diretório baseado no nome
     */
    private inferDirectoryPurpose(relativePath: string): string | undefined {
        const dirName = path.basename(relativePath).toLowerCase();
        
        if (['src', 'source', 'lib'].includes(dirName)) return 'source';
        if (['test', 'tests', '__tests__', 'spec'].includes(dirName)) return 'test';
        if (['config', 'configurations', 'settings'].includes(dirName)) return 'config';
        if (['docs', 'documentation', 'doc'].includes(dirName)) return 'documentation';
        if (['public', 'static', 'assets', 'media'].includes(dirName)) return 'assets';
        if (['components', 'component'].includes(dirName)) return 'components';
        if (['utils', 'utilities', 'helpers', 'tools'].includes(dirName)) return 'utilities';
        if (['services', 'service', 'api'].includes(dirName)) return 'services';
        if (['types', 'typings', 'interfaces'].includes(dirName)) return 'types';
        
        return undefined;
    }

    /**
     * Categoriza arquivo baseado no nome e extensão
     */
    private categorizeFile(filePath: string, structure: ProjectStructure): void {
        const fileName = path.basename(filePath).toLowerCase();
        const ext = path.extname(fileName);

        // Main files
        if (['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts', 
             'server.js', 'server.ts', 'index.html'].includes(fileName)) {
            structure.mainFiles.push(filePath);
        }

        // Config files
        if (['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
             '.eslintrc.js', '.prettierrc', 'jest.config.js', 'babel.config.js',
             'tailwind.config.js', 'next.config.js', 'nuxt.config.js',
             'vue.config.js', 'angular.json', 'pom.xml', 'build.gradle',
             'Cargo.toml', 'requirements.txt', 'setup.py', 'Dockerfile',
             'docker-compose.yml', '.env', '.env.example'].includes(fileName)) {
            structure.configFiles.push(filePath);
        }

        // Test files
        if (fileName.includes('test') || fileName.includes('spec') || 
            filePath.includes('/test/') || filePath.includes('/__tests__/') ||
            ['.test.js', '.test.ts', '.spec.js', '.spec.ts'].some(suffix => fileName.endsWith(suffix))) {
            structure.testFiles.push(filePath);
        }
    }

    /**
     * Analisa dependências do projeto
     */
    private async analyzeDependencies(workspaceRoot: string): Promise<DependencyInfo> {
        const info: DependencyInfo = {
            dependencies: [],
            devDependencies: [],
            frameworks: [],
            languages: []
        };

        // Analyze package.json
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
                info.packageJson = packageJson;
                
                if (packageJson.dependencies) {
                    info.dependencies = Object.keys(packageJson.dependencies);
                }
                if (packageJson.devDependencies) {
                    info.devDependencies = Object.keys(packageJson.devDependencies);
                }

                // Detect frameworks
                info.frameworks = this.detectFrameworks([...info.dependencies, ...info.devDependencies]);
            }
        } catch (error) {
            Logger.warn('Error analyzing package.json:', error);
        }

        // Detect languages based on files
        info.languages = await this.detectLanguages(workspaceRoot);

        return info;
    }

    /**
     * Detecta frameworks baseado nas dependências
     */
    private detectFrameworks(dependencies: string[]): string[] {
        const frameworks: string[] = [];
        const frameworkMap: { [key: string]: string } = {
            'react': 'React',
            'vue': 'Vue.js',
            'angular': 'Angular',
            'svelte': 'Svelte',
            'express': 'Express.js',
            'fastify': 'Fastify',
            'koa': 'Koa.js',
            'nest': 'NestJS',
            'next': 'Next.js',
            'nuxt': 'Nuxt.js',
            'gatsby': 'Gatsby',
            'vite': 'Vite',
            'webpack': 'Webpack',
            'rollup': 'Rollup',
            'parcel': 'Parcel',
            'electron': 'Electron',
            'ionic': 'Ionic',
            'material-ui': 'Material-UI',
            'antd': 'Ant Design',
            'bootstrap': 'Bootstrap',
            'tailwindcss': 'Tailwind CSS',
            'styled-components': 'Styled Components',
            'emotion': 'Emotion',
            'jest': 'Jest',
            'mocha': 'Mocha',
            'cypress': 'Cypress',
            'playwright': 'Playwright',
            'storybook': 'Storybook'
        };

        for (const dep of dependencies) {
            for (const [key, framework] of Object.entries(frameworkMap)) {
                if (dep.includes(key) && !frameworks.includes(framework)) {
                    frameworks.push(framework);
                }
            }
        }

        return frameworks;
    }

    /**
     * Detecta linguagens baseado nos arquivos
     */
    private async detectLanguages(workspaceRoot: string): Promise<string[]> {
        const languages = new Set<string>();
        const extensionMap: { [key: string]: string } = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript (React)',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript (React)',
            '.vue': 'Vue.js',
            '.py': 'Python',
            '.java': 'Java',
            '.kt': 'Kotlin',
            '.cs': 'C#',
            '.cpp': 'C++',
            '.c': 'C',
            '.h': 'C/C++ Header',
            '.go': 'Go',
            '.rs': 'Rust',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.swift': 'Swift',
            '.dart': 'Dart',
            '.scss': 'SCSS',
            '.sass': 'Sass',
            '.css': 'CSS',
            '.html': 'HTML',
            '.xml': 'XML',
            '.json': 'JSON',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.toml': 'TOML',
            '.md': 'Markdown'
        };

        try {
            const files = await this.getAllFiles(workspaceRoot);
            for (const file of files) {
                const ext = path.extname(file);
                if (extensionMap[ext]) {
                    languages.add(extensionMap[ext]);
                }
            }
        } catch (error) {
            Logger.warn('Error detecting languages:', error);
        }

        return Array.from(languages);
    }

    /**
     * Obtém todos os arquivos recursivamente
     */
    private async getAllFiles(dirPath: string): Promise<string[]> {
        const files: string[] = [];
        const excludePatterns = [/node_modules/, /\.git/, /dist/, /build/];

        async function walk(currentPath: string) {
            try {
                const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    
                    if (excludePatterns.some(pattern => pattern.test(fullPath))) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        await walk(fullPath);
                    } else {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip unreadable directories
            }
        }

        await walk(dirPath);
        return files;
    }

    /**
     * Analisa padrões de código
     */
    private async analyzeCodePatterns(workspaceRoot: string): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];
        
        // This is a simplified implementation
        // In a full implementation, we would use AST parsing
        
        try {
            const files = await this.getAllFiles(workspaceRoot);
            const codeFiles = files.filter(file => 
                ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs'].includes(path.extname(file))
            );

            // Analyze a sample of files to avoid performance issues
            const sampleFiles = codeFiles.slice(0, Math.min(50, codeFiles.length));
            
            for (const file of sampleFiles) {
                try {
                    const content = await fs.promises.readFile(file, 'utf8');
                    this.extractPatterns(content, file, patterns);
                } catch (error) {
                    // Skip unreadable files
                }
            }

        } catch (error) {
            Logger.warn('Error analyzing code patterns:', error);
        }

        return patterns;
    }

    /**
     * Extrai padrões básicos do código
     */
    private extractPatterns(content: string, filePath: string, patterns: CodePattern[]): void {
        const lines = content.split('\n');
        
        // Simple pattern extraction - in real implementation would use AST
        const importRegex = /^import\s+.+\s+from\s+['"`](.+)['"`]/;
        const classRegex = /^(?:export\s+)?class\s+(\w+)/;
        const functionRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
        const constRegex = /^(?:export\s+)?const\s+(\w+)/;

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (importRegex.test(trimmed)) {
                this.addOrUpdatePattern(patterns, 'import', trimmed, filePath);
            } else if (classRegex.test(trimmed)) {
                this.addOrUpdatePattern(patterns, 'class', trimmed, filePath);
            } else if (functionRegex.test(trimmed)) {
                this.addOrUpdatePattern(patterns, 'function', trimmed, filePath);
            } else if (constRegex.test(trimmed)) {
                this.addOrUpdatePattern(patterns, 'constant', trimmed, filePath);
            }
        }
    }

    /**
     * Adiciona ou atualiza padrão
     */
    private addOrUpdatePattern(
        patterns: CodePattern[], 
        type: CodePattern['type'], 
        pattern: string, 
        filePath: string
    ): void {
        const existing = patterns.find(p => p.type === type && p.pattern === pattern);
        if (existing) {
            existing.frequency++;
            if (!existing.files.includes(filePath)) {
                existing.files.push(filePath);
            }
        } else {
            patterns.push({
                type,
                pattern,
                frequency: 1,
                files: [filePath],
                examples: [pattern]
            });
        }
    }

    /**
     * Analisa arquitetura do projeto
     */
    private async analyzeArchitecture(workspaceRoot: string): Promise<ArchitectureInfo> {
        const info: ArchitectureInfo = {
            frameworks: [],
            language: 'Unknown',
            styleGuide: this.analyzeCodeStyle(workspaceRoot)
        };

        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                info.frameworks = this.detectFrameworks(Object.keys(deps));
                info.language = this.detectPrimaryLanguage(workspaceRoot);
                info.buildTool = this.detectBuildTool(Object.keys(deps));
                info.pattern = this.detectArchitecturePattern(workspaceRoot);
            }
        } catch (error) {
            Logger.warn('Error analyzing architecture:', error);
        }

        return info;
    }

    /**
     * Detecta linguagem principal
     */
    private detectPrimaryLanguage(workspaceRoot: string): string {
        if (fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))) return 'TypeScript';
        if (fs.existsSync(path.join(workspaceRoot, 'package.json'))) return 'JavaScript';
        if (fs.existsSync(path.join(workspaceRoot, 'pom.xml'))) return 'Java';
        if (fs.existsSync(path.join(workspaceRoot, 'requirements.txt'))) return 'Python';
        if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) return 'Rust';
        if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) return 'Go';
        return 'Unknown';
    }

    /**
     * Detecta ferramenta de build
     */
    private detectBuildTool(dependencies: string[]): string | undefined {
        if (dependencies.includes('vite')) return 'Vite';
        if (dependencies.includes('webpack')) return 'Webpack';
        if (dependencies.includes('rollup')) return 'Rollup';
        if (dependencies.includes('parcel')) return 'Parcel';
        if (dependencies.includes('esbuild')) return 'esbuild';
        return undefined;
    }

    /**
     * Detecta padrão arquitetural
     */
    private detectArchitecturePattern(workspaceRoot: string): string | undefined {
        const dirs = fs.readdirSync(workspaceRoot, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        if (dirs.includes('models') && dirs.includes('views') && dirs.includes('controllers')) {
            return 'MVC';
        }
        if (dirs.includes('components') && dirs.includes('pages')) {
            return 'Component-Based';
        }
        if (dirs.includes('domain') && dirs.includes('infrastructure') && dirs.includes('application')) {
            return 'Clean Architecture';
        }
        return undefined;
    }

    /**
     * Analisa estilo de código
     */
    private analyzeCodeStyle(workspaceRoot: string): CodeStyleGuide {
        // Simple implementation - would need more sophisticated analysis
        return {
            indentation: 'spaces',
            indentSize: 2,
            quotes: 'single',
            semicolons: true,
            namingConvention: 'camelCase',
            commonPatterns: []
        };
    }

    /**
     * Analisa tipos de arquivo
     */
    private async analyzeFileTypes(workspaceRoot: string): Promise<FileTypeStats> {
        const stats: FileTypeStats = {};

        try {
            const files = await this.getAllFiles(workspaceRoot);
            
            for (const file of files) {
                const ext = path.extname(file);
                if (!ext) continue;

                if (!stats[ext]) {
                    stats[ext] = {
                        count: 0,
                        totalLines: 0,
                        avgLinesPerFile: 0
                    };
                }

                stats[ext].count++;

                try {
                    const content = await fs.promises.readFile(file, 'utf8');
                    const lines = content.split('\n').length;
                    stats[ext].totalLines += lines;
                } catch (error) {
                    // Skip binary files
                }
            }

            // Calculate averages
            for (const ext in stats) {
                const stat = stats[ext];
                stat.avgLinesPerFile = Math.round(stat.totalLines / stat.count);
            }

        } catch (error) {
            Logger.warn('Error analyzing file types:', error);
        }

        return stats;
    }

    /**
     * Verifica se análise é recente (< 1 hora)
     */
    private isAnalysisRecent(): boolean {
        if (!this.analysis?.lastAnalyzed) return false;
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.analysis.lastAnalyzed > hourAgo;
    }

    /**
     * Carrega análise do cache
     */
    private loadCachedAnalysis(): void {
        try {
            const cached = this.context.globalState.get<any>(this.cacheKey);
            if (cached) {
                cached.lastAnalyzed = new Date(cached.lastAnalyzed);
                this.analysis = cached;
                Logger.info('Loaded cached workspace analysis');
            }
        } catch (error) {
            Logger.warn('Error loading cached analysis:', error);
        }
    }

    /**
     * Salva análise no cache
     */
    private saveAnalysis(): void {
        try {
            this.context.globalState.update(this.cacheKey, this.analysis);
        } catch (error) {
            Logger.error('Error saving workspace analysis:', error);
        }
    }

    /**
     * Limpa cache da análise
     */
    clearCache(): void {
        this.analysis = null;
        this.context.globalState.update(this.cacheKey, undefined);
        Logger.info('Workspace analysis cache cleared');
    }
}