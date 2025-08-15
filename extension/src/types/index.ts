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
    context?: CodeContext;
}

export interface ExtensionConfig {
    backendUrl: string;
    enableAutoContext: boolean;
    maxHistoryItems: number;
    enableGitIntegration: boolean;
    customTemplates: PromptTemplate[];
}

export interface BackendError {
    status: number;
    message: string;
    code?: string;
}

export interface CodeContext {
    selectedText?: string;
    fileName?: string;
    fileType?: string;
    lineNumbers?: {
        start: number;
        end: number;
    };
    fullFileContent?: string;
    cursorPosition?: {
        line: number;
        character: number;
    };
}

export interface PromptTemplate {
    id: string;
    title: string;
    description: string;
    prompt: string;
    requiresSelection: boolean;
    supportedFileTypes?: string[];
    isCustom?: boolean;
}

export interface ConversationEntry {
    id: string;
    timestamp: Date;
    userMessage: string;
    aiResponse: string;
    context?: CodeContext;
    fileName?: string;
    fileType?: string;
}

export interface ConversationHistory {
    entries: ConversationEntry[];
    lastUpdated: Date;
}

export interface GitInfo {
    currentBranch?: string;
    hasUncommittedChanges: boolean;
    lastCommitMessage?: string;
    changedFiles: string[];
    diff?: string;
}
