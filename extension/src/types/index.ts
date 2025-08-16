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

// Smart Refactoring Engine Types
export interface RefactoringSuggestion {
    id: string;
    type: RefactoringType;
    title: string;
    description: string;
    location: {
        range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
        uri: string;
    };
    severity: 'info' | 'warning' | 'suggestion';
    confidence: number; // 0-1
    preview?: RefactoringPreview;
    autoApply?: boolean;
}

export enum RefactoringType {
    EXTRACT_METHOD = 'extractMethod',
    EXTRACT_CLASS = 'extractClass',
    EXTRACT_INTERFACE = 'extractInterface',
    EXTRACT_VARIABLE = 'extractVariable',
    EXTRACT_CONSTANT = 'extractConstant',
    RENAME_SYMBOL = 'renameSymbol',
    MOVE_TO_FILE = 'moveToFile',
    MOVE_TO_FOLDER = 'moveToFolder',
    MODERNIZE_SYNTAX = 'modernizeSyntax',
    APPLY_DESIGN_PATTERN = 'applyDesignPattern',
    OPTIMIZE_PERFORMANCE = 'optimizePerformance',
    SIMPLIFY_CONDITION = 'simplifyCondition',
    REMOVE_DUPLICATION = 'removeDuplication'
}

export interface RefactoringPreview {
    original: string;
    refactored: string;
    diff: string;
    files: RefactoringFileChange[];
    summary: string;
}

export interface RefactoringFileChange {
    uri: string;
    originalContent: string;
    newContent: string;
    changes: TextEdit[];
}

export interface TextEdit {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    newText: string;
}

export interface CodeAnalysis {
    complexity: number;
    lineCount: number;
    functionCount: number;
    duplicateBlocks: DuplicateBlock[];
    smells: CodeSmell[];
    patterns: DetectedPattern[];
}

export interface DuplicateBlock {
    lines: { start: number; end: number };
    duplicateLines: { start: number; end: number };
    similarity: number;
}

export interface CodeSmell {
    type: 'longMethod' | 'largeClass' | 'duplicateCode' | 'longParameter' | 'deadCode';
    description: string;
    location: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    severity: 'minor' | 'major' | 'critical';
}

export interface DetectedPattern {
    name: string;
    type: 'singleton' | 'factory' | 'observer' | 'strategy' | 'command' | 'adapter' | 'decorator';
    confidence: number;
    location: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    suggestions: string[];
}

export interface RefactoringRule {
    id: string;
    name: string;
    description: string;
    pattern: RegExp | string;
    replacement: string | ((match: string, ...groups: string[]) => string);
    enabled: boolean;
    language: string[];
}

export interface BulkRefactoringOperation {
    id: string;
    title: string;
    description: string;
    files: string[];
    changes: RefactoringFileChange[];
    estimatedTime: number; // in milliseconds
    status: 'pending' | 'running' | 'completed' | 'failed';
}
