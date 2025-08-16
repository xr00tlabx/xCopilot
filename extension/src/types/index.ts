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
    prompt?: string;
    response?: string;
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

export interface WorkspaceAnalysis {
    projectStructure: ProjectStructure;
    dependencies: DependencyInfo[];
    patterns: PatternInfo[];
    conventions: ConventionInfo[];
    lastAnalyzed: Date;
}

export interface ProjectStructure {
    rootPath: string;
    packageInfo?: PackageInfo;
    frameworks: string[];
    languages: string[];
    mainDirectories: string[];
    entryPoints: string[];
}

export interface DependencyInfo {
    name: string;
    version?: string;
    type: 'dependency' | 'devDependency' | 'peerDependency';
    source: string; // package.json, requirements.txt, etc.
}

export interface PatternInfo {
    type: 'architectural' | 'design' | 'coding';
    name: string;
    description: string;
    files: string[];
    confidence: number;
}

export interface ConventionInfo {
    type: 'naming' | 'formatting' | 'structure';
    rule: string;
    examples: string[];
    confidence: number;
}

export interface PackageInfo {
    name: string;
    version: string;
    type: 'npm' | 'python' | 'maven' | 'composer' | 'other';
    scripts?: Record<string, string>;
}

export interface VectorEmbedding {
    id: string;
    filePath: string;
    content: string;
    embeddings: number[];
    metadata: {
        fileType: string;
        size: number;
        lastModified: Date;
        chunks?: string[];
    };
}

export interface ContextRetrievalResult {
    relevantFiles: string[];
    relevantContent: string[];
    embeddingScores: number[];
    totalScore: number;
}

export interface GitInfo {
    branch?: string;
    hasChanges?: boolean;
    diff?: string;
}

export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    supportedFileTypes: string[];
    variables: string[];
}
