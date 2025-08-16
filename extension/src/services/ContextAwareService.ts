import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { 
    WorkspaceAnalysis, 
    ProjectStructure, 
    DependencyInfo, 
    PatternInfo, 
    ConventionInfo, 
    PackageInfo,
    CodeContext,
    ContextRetrievalResult
} from '../types';
import { Logger } from '../utils/Logger';
import { VectorEmbeddingService } from './VectorEmbeddingService';
import { ConversationHistoryService } from './ConversationHistoryService';
import { CodeContextService } from './CodeContextService';

/**
 * Service for context-aware workspace analysis and smart context injection
 */
export class ContextAwareService {
    private static instance: ContextAwareService;
    private vectorEmbeddingService: VectorEmbeddingService;
    private conversationHistoryService: ConversationHistoryService;
    private codeContextService: CodeContextService;
    private workspaceAnalysis: WorkspaceAnalysis | null = null;
    private isAnalyzing: boolean = false;

    private constructor() {
        this.vectorEmbeddingService = VectorEmbeddingService.getInstance();
        this.conversationHistoryService = ConversationHistoryService.getInstance();
        this.codeContextService = CodeContextService.getInstance();
    }

    static getInstance(): ContextAwareService {
        if (!ContextAwareService.instance) {
            ContextAwareService.instance = new ContextAwareService();
        }
        return ContextAwareService.instance;
    }

    /**
     * Initialize the service and analyze workspace
     */
    async initialize(context: vscode.ExtensionContext): Promise<void> {
        Logger.info('Initializing ContextAwareService');
        
        // Initialize conversation history service with context
        this.conversationHistoryService = ConversationHistoryService.getInstance(context);
        
        // Start workspace analysis in background
        this.analyzeWorkspace().catch(error => {
            Logger.error('Error during workspace analysis:', error);
        });

        // Initialize vector embeddings
        this.vectorEmbeddingService.initializeWorkspace().catch(error => {
            Logger.error('Error during vector embedding initialization:', error);
        });
    }

    /**
     * Analyze the workspace for architecture, patterns, and conventions
     */
    async analyzeWorkspace(): Promise<WorkspaceAnalysis> {
        if (this.isAnalyzing) {
            Logger.warn('Workspace analysis already in progress');
            return this.workspaceAnalysis || this.createEmptyAnalysis();
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            Logger.warn('No workspace folders found');
            return this.createEmptyAnalysis();
        }

        this.isAnalyzing = true;
        Logger.info('Starting comprehensive workspace analysis');

        try {
            const rootPath = workspaceFolders[0].uri.fsPath;
            
            // Analyze project structure
            const projectStructure = await this.analyzeProjectStructure(rootPath);
            
            // Analyze dependencies
            const dependencies = await this.analyzeDependencies(rootPath);
            
            // Detect patterns
            const patterns = await this.detectPatterns(rootPath);
            
            // Extract conventions
            const conventions = await this.extractConventions(rootPath);

            this.workspaceAnalysis = {
                projectStructure,
                dependencies,
                patterns,
                conventions,
                lastAnalyzed: new Date()
            };

            Logger.info(`Workspace analysis completed. Found ${dependencies.length} dependencies, ${patterns.length} patterns, ${conventions.length} conventions`);
            return this.workspaceAnalysis;

        } catch (error) {
            Logger.error('Error during workspace analysis:', error);
            return this.createEmptyAnalysis();
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Analyze project structure
     */
    private async analyzeProjectStructure(rootPath: string): Promise<ProjectStructure> {
        const structure: ProjectStructure = {
            rootPath,
            frameworks: [],
            languages: [],
            mainDirectories: [],
            entryPoints: []
        };

        try {
            // Read root directory
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            
            // Detect package info
            structure.packageInfo = await this.detectPackageInfo(rootPath);
            
            // Identify main directories
            structure.mainDirectories = entries
                .filter(entry => entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name))
                .map(entry => entry.name);

            // Detect frameworks and languages
            const { frameworks, languages, entryPoints } = await this.detectFrameworksAndLanguages(rootPath, entries);
            structure.frameworks = frameworks;
            structure.languages = languages;
            structure.entryPoints = entryPoints;

        } catch (error) {
            Logger.error('Error analyzing project structure:', error);
        }

        return structure;
    }

    /**
     * Detect package information
     */
    private async detectPackageInfo(rootPath: string): Promise<PackageInfo | undefined> {
        const packageFiles = [
            { file: 'package.json', type: 'npm' as const },
            { file: 'requirements.txt', type: 'python' as const },
            { file: 'pom.xml', type: 'maven' as const },
            { file: 'composer.json', type: 'composer' as const }
        ];

        for (const { file, type } of packageFiles) {
            const filePath = path.join(rootPath, file);
            try {
                if (await this.fileExists(filePath)) {
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    
                    if (type === 'npm' || type === 'composer') {
                        const json = JSON.parse(content);
                        return {
                            name: json.name || 'unknown',
                            version: json.version || '0.0.0',
                            type,
                            scripts: json.scripts
                        };
                    } else if (type === 'python') {
                        return {
                            name: path.basename(rootPath),
                            version: '0.0.0',
                            type
                        };
                    }
                }
            } catch (error) {
                Logger.warn(`Error reading ${file}:`, error);
            }
        }

        return undefined;
    }

    /**
     * Detect frameworks and languages
     */
    private async detectFrameworksAndLanguages(rootPath: string, entries: fs.Dirent[]): Promise<{frameworks: string[], languages: string[], entryPoints: string[]}> {
        const frameworks: string[] = [];
        const languages = new Set<string>();
        const entryPoints: string[] = [];

        // Check for common framework indicators
        const frameworkIndicators = {
            'react': ['package.json'],
            'angular': ['angular.json'],
            'vue': ['vue.config.js'],
            'express': ['package.json'],
            'django': ['manage.py'],
            'flask': ['app.py'],
            'spring': ['pom.xml'],
            'dotnet': ['*.csproj']
        };

        // Scan files for language detection
        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name);
                const langMap: Record<string, string> = {
                    '.js': 'JavaScript',
                    '.ts': 'TypeScript',
                    '.jsx': 'React',
                    '.tsx': 'React TypeScript',
                    '.py': 'Python',
                    '.java': 'Java',
                    '.cs': 'C#',
                    '.cpp': 'C++',
                    '.c': 'C',
                    '.php': 'PHP',
                    '.go': 'Go',
                    '.rs': 'Rust',
                    '.rb': 'Ruby',
                    '.swift': 'Swift',
                    '.kt': 'Kotlin'
                };

                if (langMap[ext]) {
                    languages.add(langMap[ext]);
                }

                // Check for entry points
                if (['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts', 'server.js', 'server.ts'].includes(entry.name)) {
                    entryPoints.push(entry.name);
                }
            }
        }

        // Check for frameworks
        for (const [framework, indicators] of Object.entries(frameworkIndicators)) {
            for (const indicator of indicators) {
                if (indicator.includes('*')) {
                    // Glob pattern check
                    const pattern = indicator.replace('*', '');
                    if (entries.some(entry => entry.name.endsWith(pattern))) {
                        frameworks.push(framework);
                        break;
                    }
                } else {
                    const filePath = path.join(rootPath, indicator);
                    if (await this.fileExists(filePath)) {
                        // Additional checks for package.json
                        if (indicator === 'package.json') {
                            try {
                                const content = await fs.promises.readFile(filePath, 'utf-8');
                                const pkg = JSON.parse(content);
                                if (pkg.dependencies || pkg.devDependencies) {
                                    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                                    if (deps.react) frameworks.push('react');
                                    if (deps.express) frameworks.push('express');
                                    if (deps['@angular/core']) frameworks.push('angular');
                                    if (deps.vue) frameworks.push('vue');
                                }
                            } catch (error) {
                                Logger.warn('Error parsing package.json:', error);
                            }
                        } else {
                            frameworks.push(framework);
                        }
                        break;
                    }
                }
            }
        }

        return {
            frameworks: [...new Set(frameworks)],
            languages: Array.from(languages),
            entryPoints
        };
    }

    /**
     * Analyze dependencies
     */
    private async analyzeDependencies(rootPath: string): Promise<DependencyInfo[]> {
        const dependencies: DependencyInfo[] = [];

        // Check package.json
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (await this.fileExists(packageJsonPath)) {
            try {
                const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content);
                
                if (pkg.dependencies) {
                    for (const [name, version] of Object.entries(pkg.dependencies)) {
                        dependencies.push({
                            name,
                            version: version as string,
                            type: 'dependency',
                            source: 'package.json'
                        });
                    }
                }

                if (pkg.devDependencies) {
                    for (const [name, version] of Object.entries(pkg.devDependencies)) {
                        dependencies.push({
                            name,
                            version: version as string,
                            type: 'devDependency',
                            source: 'package.json'
                        });
                    }
                }
            } catch (error) {
                Logger.warn('Error analyzing package.json dependencies:', error);
            }
        }

        // Check requirements.txt
        const requirementsPath = path.join(rootPath, 'requirements.txt');
        if (await this.fileExists(requirementsPath)) {
            try {
                const content = await fs.promises.readFile(requirementsPath, 'utf-8');
                const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
                
                for (const line of lines) {
                    const match = line.match(/^([a-zA-Z0-9\-_]+)([>=<!=]+)?(.+)?/);
                    if (match) {
                        dependencies.push({
                            name: match[1],
                            version: match[3],
                            type: 'dependency',
                            source: 'requirements.txt'
                        });
                    }
                }
            } catch (error) {
                Logger.warn('Error analyzing requirements.txt:', error);
            }
        }

        return dependencies;
    }

    /**
     * Detect architectural and design patterns
     */
    private async detectPatterns(rootPath: string): Promise<PatternInfo[]> {
        const patterns: PatternInfo[] = [];

        try {
            // Check for MVC pattern
            const mvcDirs = ['models', 'views', 'controllers'];
            const hasMVC = mvcDirs.every(dir => 
                fs.existsSync(path.join(rootPath, dir)) || 
                fs.existsSync(path.join(rootPath, 'src', dir))
            );
            
            if (hasMVC) {
                patterns.push({
                    type: 'architectural',
                    name: 'MVC (Model-View-Controller)',
                    description: 'Separation of concerns with models, views, and controllers',
                    files: mvcDirs.map(dir => path.join('src', dir)),
                    confidence: 0.9
                });
            }

            // Check for component-based architecture (React/Vue/Angular)
            const componentDirs = await this.findDirectoriesMatching(rootPath, ['components', 'component']);
            if (componentDirs.length > 0) {
                patterns.push({
                    type: 'architectural',
                    name: 'Component-Based Architecture',
                    description: 'UI built with reusable components',
                    files: componentDirs,
                    confidence: 0.8
                });
            }

            // Check for service layer pattern
            const serviceDirs = await this.findDirectoriesMatching(rootPath, ['services', 'service']);
            if (serviceDirs.length > 0) {
                patterns.push({
                    type: 'architectural',
                    name: 'Service Layer Pattern',
                    description: 'Business logic encapsulated in service classes',
                    files: serviceDirs,
                    confidence: 0.7
                });
            }

            // Check for repository pattern
            const repoDirs = await this.findDirectoriesMatching(rootPath, ['repositories', 'repository', 'dao']);
            if (repoDirs.length > 0) {
                patterns.push({
                    type: 'design',
                    name: 'Repository Pattern',
                    description: 'Data access abstraction layer',
                    files: repoDirs,
                    confidence: 0.8
                });
            }

        } catch (error) {
            Logger.error('Error detecting patterns:', error);
        }

        return patterns;
    }

    /**
     * Extract coding conventions
     */
    private async extractConventions(rootPath: string): Promise<ConventionInfo[]> {
        const conventions: ConventionInfo[] = [];

        try {
            // Check for naming conventions by analyzing file names
            const files = await this.getFilesSample(rootPath, 20);
            
            // Analyze case conventions
            const kebabCase = files.filter(f => /^[a-z]+(-[a-z]+)*\.[a-z]+$/.test(path.basename(f))).length;
            const camelCase = files.filter(f => /^[a-z][a-zA-Z]*\.[a-z]+$/.test(path.basename(f))).length;
            const pascalCase = files.filter(f => /^[A-Z][a-zA-Z]*\.[a-z]+$/.test(path.basename(f))).length;

            const total = files.length;
            if (kebabCase > total * 0.3) {
                conventions.push({
                    type: 'naming',
                    rule: 'kebab-case for file names',
                    examples: files.filter(f => /^[a-z]+(-[a-z]+)*\.[a-z]+$/.test(path.basename(f))).slice(0, 3),
                    confidence: kebabCase / total
                });
            }

            if (camelCase > total * 0.3) {
                conventions.push({
                    type: 'naming',
                    rule: 'camelCase for file names',
                    examples: files.filter(f => /^[a-z][a-zA-Z]*\.[a-z]+$/.test(path.basename(f))).slice(0, 3),
                    confidence: camelCase / total
                });
            }

            if (pascalCase > total * 0.3) {
                conventions.push({
                    type: 'naming',
                    rule: 'PascalCase for file names',
                    examples: files.filter(f => /^[A-Z][a-zA-Z]*\.[a-z]+$/.test(path.basename(f))).slice(0, 3),
                    confidence: pascalCase / total
                });
            }

        } catch (error) {
            Logger.error('Error extracting conventions:', error);
        }

        return conventions;
    }

    /**
     * Get enhanced context for chat with RAG
     */
    async getEnhancedContext(userMessage: string, includeHistory: boolean = true): Promise<{
        currentContext: CodeContext | null;
        retrievalContext: ContextRetrievalResult;
        conversationContext: string;
        workspaceContext: string;
    }> {
        // Get current file context
        const currentContext = this.codeContextService.getContextWithFallback(10);

        // Get relevant context using vector embeddings
        const retrievalContext = await this.vectorEmbeddingService.retrieveRelevantContext(userMessage, 3);

        // Get conversation context
        let conversationContext = '';
        if (includeHistory) {
            const recentEntries = this.conversationHistoryService.getRecentEntries(5);
            conversationContext = recentEntries.map(entry => 
                `Q: ${entry.userMessage}\nA: ${entry.aiResponse}`
            ).join('\n\n');
        }

        // Get workspace context
        const workspaceContext = this.buildWorkspaceContextString();

        return {
            currentContext,
            retrievalContext,
            conversationContext,
            workspaceContext
        };
    }

    /**
     * Build workspace context string
     */
    private buildWorkspaceContextString(): string {
        if (!this.workspaceAnalysis) {
            return 'Workspace analysis not available';
        }

        const { projectStructure, dependencies, patterns, conventions } = this.workspaceAnalysis;
        
        const context = [
            `Project: ${projectStructure.packageInfo?.name || 'Unknown'}`,
            `Languages: ${projectStructure.languages.join(', ')}`,
            `Frameworks: ${projectStructure.frameworks.join(', ')}`,
            `Main Dependencies: ${dependencies.filter(d => d.type === 'dependency').slice(0, 5).map(d => d.name).join(', ')}`,
            `Architecture Patterns: ${patterns.map(p => p.name).join(', ')}`,
            `Conventions: ${conventions.map(c => c.rule).join(', ')}`
        ].join('\n');

        return context;
    }

    /**
     * Utility methods
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async findDirectoriesMatching(rootPath: string, patterns: string[]): Promise<string[]> {
        const found: string[] = [];
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    for (const pattern of patterns) {
                        if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
                            found.push(path.join(rootPath, entry.name));
                        }
                    }
                }
            }
        } catch (error) {
            Logger.warn(`Error finding directories in ${rootPath}:`, error);
        }
        return found;
    }

    private async getFilesSample(rootPath: string, limit: number): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && files.length < limit) {
                    files.push(path.join(rootPath, entry.name));
                }
            }
        } catch (error) {
            Logger.warn(`Error getting files sample from ${rootPath}:`, error);
        }
        return files;
    }

    private createEmptyAnalysis(): WorkspaceAnalysis {
        return {
            projectStructure: {
                rootPath: '',
                frameworks: [],
                languages: [],
                mainDirectories: [],
                entryPoints: []
            },
            dependencies: [],
            patterns: [],
            conventions: [],
            lastAnalyzed: new Date()
        };
    }

    /**
     * Get workspace analysis
     */
    getWorkspaceAnalysis(): WorkspaceAnalysis | null {
        return this.workspaceAnalysis;
    }

    /**
     * Check if analysis is ready
     */
    isAnalysisReady(): boolean {
        return this.workspaceAnalysis !== null && !this.isAnalyzing;
    }
}