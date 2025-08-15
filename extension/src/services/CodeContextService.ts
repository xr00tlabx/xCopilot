import * as vscode from 'vscode';
import { CodeContext } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para capturar e gerenciar contexto de código
 */
export class CodeContextService {
    private static instance: CodeContextService;

    private constructor() {}

    static getInstance(): CodeContextService {
        if (!CodeContextService.instance) {
            CodeContextService.instance = new CodeContextService();
        }
        return CodeContextService.instance;
    }

    /**
     * Captura o contexto atual do editor
     */
    getCurrentContext(includeFullFile: boolean = false): CodeContext | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Logger.warn('No active editor found');
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;
        
        const context: CodeContext = {
            fileName: this.getFileName(document),
            fileType: this.getFileType(document),
            cursorPosition: {
                line: selection.active.line,
                character: selection.active.character
            }
        };

        // Adicionar texto selecionado se houver
        if (!selection.isEmpty) {
            context.selectedText = document.getText(selection);
            context.lineNumbers = {
                start: selection.start.line + 1,
                end: selection.end.line + 1
            };
            Logger.debug(`Selected text: ${context.selectedText.length} characters`);
        }

        // Adicionar conteúdo completo do arquivo se solicitado
        if (includeFullFile) {
            context.fullFileContent = document.getText();
            Logger.debug(`Full file content: ${context.fullFileContent.length} characters`);
        }

        Logger.info(`Context captured for ${context.fileName} (${context.fileType})`);
        return context;
    }

    /**
     * Captura contexto com texto selecionado ou contexto ao redor do cursor
     */
    getContextWithFallback(lines: number = 10): CodeContext | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const context = this.getCurrentContext();
        if (!context) {
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;

        // Se não há seleção, capturar linhas ao redor do cursor
        if (selection.isEmpty) {
            const currentLine = selection.active.line;
            const startLine = Math.max(0, currentLine - Math.floor(lines / 2));
            const endLine = Math.min(document.lineCount - 1, currentLine + Math.floor(lines / 2));
            
            const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
            context.selectedText = document.getText(range);
            context.lineNumbers = {
                start: startLine + 1,
                end: endLine + 1
            };
            
            Logger.debug(`Fallback context: lines ${startLine + 1}-${endLine + 1}`);
        }

        return context;
    }

    /**
     * Obtém o nome do arquivo sem o caminho completo
     */
    private getFileName(document: vscode.TextDocument): string {
        if (document.isUntitled) {
            return `Untitled-${document.languageId}`;
        }
        
        const path = document.fileName;
        const segments = path.split(/[\\\/]/);
        return segments[segments.length - 1];
    }

    /**
     * Obtém o tipo de arquivo baseado na extensão e linguagem
     */
    private getFileType(document: vscode.TextDocument): string {
        return document.languageId;
    }

    /**
     * Formata o contexto para envio ao backend
     */
    formatContextForPrompt(context: CodeContext, userPrompt: string): string {
        let formattedPrompt = userPrompt;

        if (context.fileName) {
            formattedPrompt += `\n\n**Arquivo:** ${context.fileName}`;
        }

        if (context.fileType) {
            formattedPrompt += `\n**Tipo:** ${context.fileType}`;
        }

        if (context.selectedText) {
            const lineInfo = context.lineNumbers ? 
                ` (linhas ${context.lineNumbers.start}-${context.lineNumbers.end})` : '';
            
            formattedPrompt += `\n\n**Código selecionado${lineInfo}:**\n\`\`\`${context.fileType}\n${context.selectedText}\n\`\`\``;
        }

        if (context.fullFileContent && !context.selectedText) {
            formattedPrompt += `\n\n**Conteúdo completo do arquivo:**\n\`\`\`${context.fileType}\n${context.fullFileContent}\n\`\`\``;
        }

        return formattedPrompt;
    }

    /**
     * Verifica se há contexto útil disponível
     */
    hasUsefulContext(): boolean {
        const editor = vscode.window.activeTextEditor;
        return editor !== undefined;
    }

    /**
     * Obtém estatísticas do contexto atual
     */
    getContextStats(): { fileName?: string; fileType?: string; hasSelection: boolean; linesInFile: number } | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        return {
            fileName: this.getFileName(editor.document),
            fileType: this.getFileType(editor.document),
            hasSelection: !editor.selection.isEmpty,
            linesInFile: editor.document.lineCount
        };
    }
}
