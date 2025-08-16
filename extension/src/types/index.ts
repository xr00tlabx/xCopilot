/**
 * Tipos e interfaces para a extensão xCopilot
 */

export interface BackendResponse {
    resposta?: string;
    response?: string;
    [key: string]: any;
}

export interface ChatMessage {
    type: 'ask' | 'answer';
    prompt?: string;
    text?: string;
}

export interface ExtensionConfig {
    backendUrl: string;
    inlineCompletion: {
        enabled: boolean;
        throttleMs: number;
        cacheSize: number;
        maxContextLines: number;
    };
    ghostText: {
        enabled: boolean;
        throttleMs: number;
    };
}

export interface BackendError {
    status: number;
    message: string;
    code?: string;
}

export interface CodeContext {
    fileName?: string;
    fileType?: string;
    selectedText?: string;
    fullFileContent?: string;
    cursorPosition?: {
        line: number;
        character: number;
    };
    lineNumbers?: {
        start: number;
        end: number;
    };
}

export interface ConversationEntry {
    id: string;
    timestamp: Date;
    userMessage: string;
    aiResponse: string;
    fileName?: string;
    fileType?: string;
    context?: CodeContext;
    relevantFiles?: string[];
    embeddingScore?: number;
}

export interface ConversationHistory {
    entries: ConversationEntry[];
    totalEntries: number;
    lastUpdated?: Date;
}

export interface GitInfo {
    branch?: string;
    currentBranch?: string;
    hasChanges?: boolean;
    hasUncommittedChanges?: boolean;
    diff?: string;
    changedFiles?: string[];
    lastCommitMessage?: string;
    recentCommits?: GitCommit[];
}

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: Date;
    files: string[];
}

export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    supportedFileTypes: string[];
    variables: string[];
}

// New interfaces for context-aware features
export interface WorkspaceAnalysis {
    projectStructure: ProjectStructure;
    dependencies: DependencyInfo;
    codePatterns: CodePattern[];
    architecture: ArchitectureInfo;
    fileTypes: FileTypeStats;
    lastAnalyzed: Date;
}

export interface ProjectStructure {
    totalFiles: number;
    totalLines: number;
    directories: DirectoryInfo[];
    mainFiles: string[];
    configFiles: string[];
    testFiles: string[];
}

export interface DirectoryInfo {
    path: string;
    fileCount: number;
    subDirectories: string[];
    purpose?: string; // src, test, config, docs, etc.
}

export interface DependencyInfo {
    packageJson?: any;
    lockFile?: string;
    dependencies: string[];
    devDependencies: string[];
    frameworks: string[];
    languages: string[];
}

export interface CodePattern {
    type: 'class' | 'function' | 'constant' | 'import' | 'export';
    pattern: string;
    frequency: number;
    files: string[];
    examples: string[];
}

export interface ArchitectureInfo {
    pattern?: string; // MVC, Clean Architecture, etc.
    frameworks: string[];
    buildTool?: string;
    language: string;
    styleGuide?: CodeStyleGuide;
}

export interface CodeStyleGuide {
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    quotes: 'single' | 'double';
    semicolons: boolean;
    namingConvention: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';
    commonPatterns: string[];
}

export interface FileTypeStats {
    [extension: string]: {
        count: number;
        totalLines: number;
        avgLinesPerFile: number;
    };
}

export interface ContextualSuggestion {
    id: string;
    type: 'refactor' | 'optimize' | 'test' | 'documentation' | 'pattern';
    title: string;
    description: string;
    relevance: number; // 0-1 score
    context: string; // what makes this relevant
    action?: string; // command to execute
}

export interface ConversationContext {
    workspaceAnalysis?: WorkspaceAnalysis;
    currentFile?: CodeContext;
    gitInfo?: GitInfo;
    recentConversations: ConversationEntry[];
    relevantCode: string[];
    suggestions: ContextualSuggestion[];
    memoryContext?: string; // RAG retrieved context
}

export interface SemanticSearchResult {
    content: string;
    similarity: number;
    source: 'conversation' | 'code' | 'documentation';
    metadata: any;
}

export interface ContextAwareConfig {
    enableWorkspaceAnalysis: boolean;
    enableSemanticSearch: boolean;
    maxContextSize: number;
    analysisDepth: 'shallow' | 'medium' | 'deep';
    memorySessions: number;
    autoSuggestions: boolean;
}
