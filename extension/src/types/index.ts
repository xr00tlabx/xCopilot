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

// Multi-line Code Generation Types
export interface CommentAnalysis {
    type: 'TODO' | 'FIXME' | 'JSDoc' | 'CUSTOM';
    content: string;
    line: number;
    intention: string;
    requirements?: string[];
    parameters?: string[];
    returnType?: string;
}

export interface CodeTemplate {
    id: string;
    name: string;
    description: string;
    pattern: 'CRUD' | 'Repository' | 'Factory' | 'Service' | 'Interface' | 'Function' | 'Class';
    language: 'javascript' | 'typescript' | 'python' | 'java';
    template: string;
    variables: string[];
}

export interface CodeGenerationRequest {
    type: 'comment' | 'interface' | 'function' | 'pattern';
    language: string;
    context: CodeContext;
    specification?: string;
    template?: CodeTemplate;
    preview?: boolean;
}

export interface CodeGenerationResult {
    success: boolean;
    code: string;
    description: string;
    language: string;
    insertPosition?: {
        line: number;
        character: number;
    };
    error?: string;
}

export interface ASTAnalysis {
    imports: string[];
    interfaces: InterfaceInfo[];
    classes: ClassInfo[];
    functions: FunctionInfo[];
    patterns: string[];
    suggestions: string[];
}

export interface InterfaceInfo {
    name: string;
    properties: PropertyInfo[];
    methods: MethodInfo[];
    isEmpty: boolean;
    line: number;
}

export interface ClassInfo {
    name: string;
    extends?: string;
    implements?: string[];
    properties: PropertyInfo[];
    methods: MethodInfo[];
    constructor?: MethodInfo;
    line: number;
}

export interface FunctionInfo {
    name: string;
    parameters: ParameterInfo[];
    returnType?: string;
    isAsync: boolean;
    isExported: boolean;
    hasImplementation: boolean;
    line: number;
}

export interface PropertyInfo {
    name: string;
    type?: string;
    isOptional: boolean;
    isReadonly: boolean;
}

export interface MethodInfo {
    name: string;
    parameters: ParameterInfo[];
    returnType?: string;
    isAsync: boolean;
    isAbstract: boolean;
    hasImplementation: boolean;
}

export interface ParameterInfo {
    name: string;
    type?: string;
    isOptional: boolean;
    defaultValue?: string;
}
