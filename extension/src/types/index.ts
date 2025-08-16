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
    prompt: string;
    response: string;
    fileName?: string;
    fileType?: string;
    context?: CodeContext;
}

export interface ConversationHistory {
    entries: ConversationEntry[];
    totalEntries: number;
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

// Code Review Types
export interface CodeReviewIssue {
    type: 'code_smell' | 'best_practice' | 'security' | 'performance' | 'testing' | 'documentation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    suggestion: string;
    file: string;
    line?: number;
    endLine?: number;
    column?: number;
    endColumn?: number;
    autoFixAvailable: boolean;
}

export interface CodeReviewResult {
    overallScore: number; // 0-100
    issues: CodeReviewIssue[];
    summary: {
        totalIssues: number;
        codeQuality: number;
        bestPractices: number;
        testing: number;
        documentation: number;
        security: number;
        performance: number;
    };
    recommendations: string[];
    changedFiles: string[];
    addedLines: number;
    removedLines: number;
}

export interface ReviewConfig {
    enabledChecks: {
        codeSmells: boolean;
        bestPractices: boolean;
        testing: boolean;
        documentation: boolean;
        security: boolean;
        performance: boolean;
    };
    thresholds: {
        minScore: number;
        maxComplexity: number;
        maxFunctionLength: number;
        requireTests: boolean;
        requireDocumentation: boolean;
    };
    autoApprove: boolean;
    autoComment: boolean;
}
