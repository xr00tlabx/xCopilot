/**
 * Serviço principal para geração de código multi-linha
 * Orquestra análise de comentários, AST e geração de código
 */

import * as vscode from 'vscode';
import { CommentAnalysisService } from './CommentAnalysisService';
import { CodeGenerationService } from './CodeGenerationService';
import { ASTAnalysisService } from './ASTAnalysisService';
import { 
    CommentAnalysis, 
    CodeGenerationRequest, 
    CodeGenerationResult, 
    ASTAnalysis,
    InterfaceInfo,
    FunctionInfo
} from '../types';

export class MultilineCodeGenerationService {
    private static instance: MultilineCodeGenerationService;
    private commentAnalysis: CommentAnalysisService;
    private codeGeneration: CodeGenerationService;
    private astAnalysis: ASTAnalysisService;

    private constructor() {
        this.commentAnalysis = CommentAnalysisService.getInstance();
        this.codeGeneration = CodeGenerationService.getInstance();
        this.astAnalysis = ASTAnalysisService.getInstance();
    }

    public static getInstance(): MultilineCodeGenerationService {
        if (!MultilineCodeGenerationService.instance) {
            MultilineCodeGenerationService.instance = new MultilineCodeGenerationService();
        }
        return MultilineCodeGenerationService.instance;
    }

    /**
     * Detecta comentários TODO/FIXME automaticamente e oferece geração de código
     */
    public async detectAndGenerateFromComments(document?: vscode.TextDocument): Promise<void> {
        const doc = document || vscode.window.activeTextEditor?.document;
        if (!doc) {
            vscode.window.showErrorMessage('No active document found');
            return;
        }

        try {
            const comments = this.commentAnalysis.analyzeDocument(doc);
            const implementationComments = comments.filter(c => 
                c.type === 'TODO' || c.type === 'FIXME' || 
                this.commentAnalysis.isImplementationComment(c.content)
            );

            if (implementationComments.length === 0) {
                vscode.window.showInformationMessage('No implementation comments found');
                return;
            }

            // Mostra lista de comentários para o usuário escolher
            const items = implementationComments.map(comment => ({
                label: `Line ${comment.line + 1}: ${comment.intention}`,
                description: comment.type,
                detail: comment.content,
                comment
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a comment to generate code for',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                await this.generateCodeFromComment(doc, selected.comment);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error detecting comments: ${error}`);
        }
    }

    /**
     * Gera código a partir de um comentário específico
     */
    public async generateCodeFromComment(document: vscode.TextDocument, comment: CommentAnalysis): Promise<void> {
        try {
            const language = this.astAnalysis.detectLanguage(document);
            const result = await this.codeGeneration.generateFromComment(comment, language);

            if (result.success) {
                await this.insertOrPreviewCode(document, result, comment.line + 1);
            } else {
                vscode.window.showErrorMessage(`Code generation failed: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating code: ${error}`);
        }
    }

    /**
     * Implementa interfaces vazias automaticamente
     */
    public async implementEmptyInterfaces(document?: vscode.TextDocument): Promise<void> {
        const doc = document || vscode.window.activeTextEditor?.document;
        if (!doc) {
            vscode.window.showErrorMessage('No active document found');
            return;
        }

        try {
            const emptyInterfaces = this.astAnalysis.findEmptyInterfaces(doc);

            if (emptyInterfaces.length === 0) {
                vscode.window.showInformationMessage('No empty interfaces found');
                return;
            }

            // Mostra lista de interfaces vazias
            const items = emptyInterfaces.map(iface => ({
                label: iface.name,
                description: `Line ${iface.line + 1}`,
                detail: 'Empty interface',
                interface: iface
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an interface to implement',
                canPickMany: true
            });

            if (selected && selected.length > 0) {
                for (const item of selected) {
                    await this.generateInterfaceImplementation(doc, item.interface);
                }
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error implementing interfaces: ${error}`);
        }
    }

    /**
     * Gera implementação para uma interface
     */
    public async generateInterfaceImplementation(document: vscode.TextDocument, interfaceInfo: InterfaceInfo): Promise<void> {
        try {
            const language = this.astAnalysis.detectLanguage(document);
            const className = `${interfaceInfo.name}Impl`;

            const request: CodeGenerationRequest = {
                type: 'interface',
                language,
                context: {
                    fileName: document.fileName,
                    fileType: language,
                    selectedText: interfaceInfo.name
                },
                specification: `Implement interface ${interfaceInfo.name}`,
                template: this.codeGeneration.getTemplate(`${language.substring(0, 2)}-interface`)
            };

            const result = await this.codeGeneration.generateCode(request);

            if (result.success) {
                // Encontra uma boa posição para inserir a implementação
                const insertLine = this.findBestInsertionPoint(document, interfaceInfo.line);
                await this.insertOrPreviewCode(document, result, insertLine);
            } else {
                vscode.window.showErrorMessage(`Implementation generation failed: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating implementation: ${error}`);
        }
    }

    /**
     * Gera funções completas a partir de especificação
     */
    public async generateCompleteFunction(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            // Pede especificação ao usuário
            const specification = await vscode.window.showInputBox({
                prompt: 'Enter function specification (e.g., "function calculateTax(amount: number, rate: number): number")',
                placeHolder: 'function name(params): returnType - description'
            });

            if (!specification) {
                return;
            }

            const language = this.astAnalysis.detectLanguage(editor.document);
            const position = editor.selection.active;

            const request: CodeGenerationRequest = {
                type: 'function',
                language,
                context: {
                    fileName: editor.document.fileName,
                    fileType: language,
                    cursorPosition: {
                        line: position.line,
                        character: position.character
                    }
                },
                specification,
                preview: true
            };

            const result = await this.codeGeneration.generateCode(request);

            if (result.success) {
                await this.insertOrPreviewCode(editor.document, result, position.line);
            } else {
                vscode.window.showErrorMessage(`Function generation failed: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating function: ${error}`);
        }
    }

    /**
     * Gera código baseado em padrões (CRUD, Repository, Factory, etc.)
     */
    public async generateFromPattern(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            const language = this.astAnalysis.detectLanguage(editor.document);
            const templates = this.codeGeneration.getTemplatesByLanguage(language);

            if (templates.length === 0) {
                vscode.window.showErrorMessage(`No templates available for ${language}`);
                return;
            }

            // Mostra lista de padrões disponíveis
            const items = templates.map(template => ({
                label: template.name,
                description: template.pattern,
                detail: template.description,
                template
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a pattern to generate'
            });

            if (!selected) {
                return;
            }

            // Pede nome da entidade se for um padrão que precisa
            let entityName = 'Entity';
            if (['CRUD', 'Repository', 'Factory'].includes(selected.template.pattern)) {
                const input = await vscode.window.showInputBox({
                    prompt: `Enter entity name for ${selected.template.pattern} pattern`,
                    placeHolder: 'e.g., User, Product, Order'
                });
                if (input) {
                    entityName = input;
                }
            }

            const position = editor.selection.active;
            const request: CodeGenerationRequest = {
                type: 'pattern',
                language,
                context: {
                    fileName: editor.document.fileName,
                    fileType: language,
                    cursorPosition: {
                        line: position.line,
                        character: position.character
                    }
                },
                specification: `Generate ${selected.template.pattern} pattern for ${entityName}`,
                template: selected.template,
                preview: true
            };

            const result = await this.codeGeneration.generateCode(request);

            if (result.success) {
                await this.insertOrPreviewCode(editor.document, result, position.line);
            } else {
                vscode.window.showErrorMessage(`Pattern generation failed: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating pattern: ${error}`);
        }
    }

    /**
     * Analisa padrões arquiteturais no código atual
     */
    public async analyzeCodePatterns(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            const analysis = this.astAnalysis.analyzeDocument(editor.document);
            
            const info = [
                `**Code Analysis for ${editor.document.fileName}**`,
                '',
                `**Imports:** ${analysis.imports.length}`,
                ...analysis.imports.slice(0, 5).map(imp => `  - ${imp}`),
                analysis.imports.length > 5 ? `  ... and ${analysis.imports.length - 5} more` : '',
                '',
                `**Interfaces:** ${analysis.interfaces.length}`,
                ...analysis.interfaces.map(iface => `  - ${iface.name} (${iface.isEmpty ? 'empty' : 'implemented'})`),
                '',
                `**Classes:** ${analysis.classes.length}`,
                ...analysis.classes.map(cls => `  - ${cls.name} (${cls.methods.length} methods)`),
                '',
                `**Functions:** ${analysis.functions.length}`,
                ...analysis.functions.slice(0, 3).map(func => `  - ${func.name}(${func.parameters.length} params)`),
                '',
                `**Detected Patterns:** ${analysis.patterns.length}`,
                ...analysis.patterns.map(pattern => `  - ${pattern}`),
                '',
                `**Suggestions:**`,
                ...analysis.suggestions.map(suggestion => `  - ${suggestion}`)
            ].filter(line => line !== '').join('\n');

            // Mostra em um painel de informações
            const panel = vscode.window.createWebviewPanel(
                'codeAnalysis',
                'Code Analysis',
                vscode.ViewColumn.Beside,
                { enableScripts: false }
            );

            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
                        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
                        h3 { color: #007acc; }
                    </style>
                </head>
                <body>
                    <pre>${info}</pre>
                </body>
                </html>
            `;

        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing code: ${error}`);
        }
    }

    /**
     * Insere código ou mostra preview
     */
    private async insertOrPreviewCode(
        document: vscode.TextDocument, 
        result: CodeGenerationResult, 
        insertLine: number
    ): Promise<void> {
        // Mostra preview primeiro
        const action = await vscode.window.showInformationMessage(
            `Generated ${result.description}. Do you want to insert it?`,
            { modal: false },
            'Insert', 'Preview', 'Cancel'
        );

        if (action === 'Preview') {
            await this.showCodePreview(result);
            return;
        }

        if (action === 'Insert') {
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(insertLine, 0);
            
            await editor.edit(editBuilder => {
                editBuilder.insert(position, result.code + '\n\n');
            });

            vscode.window.showInformationMessage('Code inserted successfully!');
        }
    }

    /**
     * Mostra preview do código gerado
     */
    private async showCodePreview(result: CodeGenerationResult): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'codePreview',
            'Generated Code Preview',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        padding: 20px; 
                        background: #1e1e1e; 
                        color: #d4d4d4; 
                    }
                    .header { 
                        background: #007acc; 
                        color: white; 
                        padding: 10px; 
                        border-radius: 5px; 
                        margin-bottom: 20px; 
                    }
                    .code { 
                        background: #2d2d2d; 
                        padding: 15px; 
                        border-radius: 5px; 
                        border: 1px solid #555; 
                        white-space: pre-wrap;
                        overflow-x: auto;
                    }
                    .actions {
                        margin-top: 20px;
                        text-align: center;
                    }
                    button {
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 0 10px;
                    }
                    button:hover {
                        background: #005a9e;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h3>📝 ${result.description}</h3>
                    <p>Language: ${result.language}</p>
                </div>
                <div class="code">${this.escapeHtml(result.code)}</div>
                <div class="actions">
                    <button onclick="copyToClipboard()">📋 Copy</button>
                    <button onclick="closePreview()">❌ Close</button>
                </div>
                
                <script>
                    function copyToClipboard() {
                        navigator.clipboard.writeText(\`${result.code.replace(/`/g, '\\`')}\`);
                        alert('Code copied to clipboard!');
                    }
                    
                    function closePreview() {
                        window.close();
                    }
                </script>
            </body>
            </html>
        `;
    }

    /**
     * Encontra o melhor ponto de inserção para novo código
     */
    private findBestInsertionPoint(document: vscode.TextDocument, nearLine: number): number {
        const lines = document.getText().split('\n');
        
        // Procura por uma linha vazia próxima
        for (let i = nearLine + 1; i < Math.min(nearLine + 10, lines.length); i++) {
            if (lines[i].trim() === '') {
                return i;
            }
        }

        // Se não encontrou, insere após a linha atual
        return nearLine + 1;
    }

    /**
     * Escapa HTML para preview
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Detecta automaticamente comentários TODO/FIXME em todos os arquivos do workspace
     */
    public async scanWorkspaceForComments(): Promise<void> {
        try {
            const comments = await this.commentAnalysis.findAllComments();
            
            if (comments.length === 0) {
                vscode.window.showInformationMessage('No TODO/FIXME comments found in workspace');
                return;
            }

            // Agrupa comentários por arquivo
            const commentsByFile = new Map<string, CommentAnalysis[]>();
            comments.forEach(comment => {
                // Note: findAllComments doesn't return file info, so this is a placeholder
                const file = 'unknown';
                if (!commentsByFile.has(file)) {
                    commentsByFile.set(file, []);
                }
                commentsByFile.get(file)!.push(comment);
            });

            const info = [
                `**TODO/FIXME Comments in Workspace**`,
                `Found ${comments.length} comments`,
                ''
            ];

            commentsByFile.forEach((fileComments, file) => {
                info.push(`**${file}:**`);
                fileComments.forEach(comment => {
                    info.push(`  - Line ${comment.line + 1}: ${comment.intention} (${comment.type})`);
                });
                info.push('');
            });

            // Mostra relatório
            const panel = vscode.window.createWebviewPanel(
                'todoReport',
                'TODO/FIXME Report',
                vscode.ViewColumn.Beside,
                { enableScripts: false }
            );

            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
                        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
                        h3 { color: #007acc; }
                    </style>
                </head>
                <body>
                    <pre>${info.join('\n')}</pre>
                </body>
                </html>
            `;

        } catch (error) {
            vscode.window.showErrorMessage(`Error scanning workspace: ${error}`);
        }
    }
}