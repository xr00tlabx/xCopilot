import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { ConfigurationService } from './ConfigurationService';

/**
 * Serviço para geração de código multi-linha (similar ao GitHub Copilot)
 * Detecta comentários TODO/FIXME e gera implementações completas
 */
export class MultilineGenerationService {
    private static instance: MultilineGenerationService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private configService: ConfigurationService;
    private disposables: vscode.Disposable[] = [];
    private isEnabled = true;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.configService = ConfigurationService.getInstance();
        
        this.setupEventListeners();
    }

    static getInstance(): MultilineGenerationService {
        if (!MultilineGenerationService.instance) {
            MultilineGenerationService.instance = new MultilineGenerationService();
        }
        return MultilineGenerationService.instance;
    }

    /**
     * Configura os event listeners para detectar oportunidades de geração
     */
    private setupEventListeners(): void {
        // Listener para mudanças no documento
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.onDocumentChange(event);
            })
        );

        // Listener para salvar documento
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.analyzeDocumentForGeneration(document);
            })
        );
    }

    /**
     * Analisa mudanças no documento para detectar comentários
     */
    private async onDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        if (!this.isEnabled || !this.isSupportedLanguage(event.document.languageId)) {
            return;
        }

        for (const change of event.contentChanges) {
            if (this.isGenerationTrigger(change.text)) {
                await this.handleGenerationTrigger(event.document, change);
            }
        }
    }

    /**
     * Verifica se o texto inserido é um trigger para geração
     */
    private isGenerationTrigger(text: string): boolean {
        const triggers = [
            'TODO:', 'FIXME:', 'HACK:', 'NOTE:',
            '// TODO', '// FIXME', '/* TODO', '/* FIXME',
            '# TODO', '# FIXME',
            '"""', "'''", // Python docstrings
            '/**', // JSDoc
        ];

        return triggers.some(trigger => 
            text.toLowerCase().includes(trigger.toLowerCase())
        );
    }

    /**
     * Trata trigger de geração detectado
     */
    private async handleGenerationTrigger(
        document: vscode.TextDocument, 
        change: vscode.TextDocumentContentChangeEvent
    ): Promise<void> {
        try {
            const position = change.range.start;
            const line = document.lineAt(position.line);
            
            // Aguardar um momento para o usuário terminar de digitar
            setTimeout(async () => {
                await this.offerCodeGeneration(document, position, line.text);
            }, 2000);

        } catch (error) {
            Logger.error('Error handling generation trigger:', error);
        }
    }

    /**
     * Oferece geração de código baseada no comentário
     */
    private async offerCodeGeneration(
        document: vscode.TextDocument,
        position: vscode.Position,
        lineText: string
    ): Promise<void> {
        const generationType = this.detectGenerationType(lineText, document, position);
        
        if (!generationType) {
            return;
        }

        const suggestion = await vscode.window.showInformationMessage(
            `xCopilot detectou: ${generationType.description}. Gerar implementação?`,
            'Gerar', 'Ignorar'
        );

        if (suggestion === 'Gerar') {
            await this.generateImplementation(document, position, generationType);
        }
    }

    /**
     * Detecta o tipo de geração necessária
     */
    private detectGenerationType(
        lineText: string, 
        document: vscode.TextDocument, 
        position: vscode.Position
    ): GenerationType | null {
        const line = lineText.trim().toLowerCase();
        
        // Função a partir de comentário JSDoc
        if (line.includes('/**') || this.isJSDocComment(document, position)) {
            return {
                type: 'function',
                description: 'Função a partir de JSDoc',
                prompt: this.buildFunctionPrompt(document, position)
            };
        }

        // TODO/FIXME implementation
        if (line.includes('todo:') || line.includes('fixme:')) {
            return {
                type: 'implementation',
                description: 'Implementação de TODO/FIXME',
                prompt: this.buildTodoPrompt(document, position, lineText)
            };
        }

        // Interface implementation
        if (this.isInterfaceImplementation(document, position)) {
            return {
                type: 'interface',
                description: 'Implementação de interface',
                prompt: this.buildInterfacePrompt(document, position)
            };
        }

        // Class skeleton
        if (this.isClassDeclaration(document, position)) {
            return {
                type: 'class',
                description: 'Esqueleto de classe',
                prompt: this.buildClassPrompt(document, position)
            };
        }

        return null;
    }

    /**
     * Gera implementação baseada no tipo detectado
     */
    private async generateImplementation(
        document: vscode.TextDocument,
        position: vscode.Position,
        generationType: GenerationType
    ): Promise<void> {
        try {
            vscode.window.showInformationMessage('Gerando código...');

            const response = await this.backendService.requestMultilineGeneration({
                prompt: generationType.prompt,
                type: generationType.type,
                language: document.languageId,
                context: this.contextService.getContextWithFallback(20)?.content || ''
            });

            if (response.code) {
                await this.insertGeneratedCode(document, position, response.code, generationType.type);
                vscode.window.showInformationMessage('Código gerado com sucesso!');
            }

        } catch (error) {
            Logger.error('Error generating implementation:', error);
            vscode.window.showErrorMessage('Erro ao gerar código: ' + error);
        }
    }

    /**
     * Insere o código gerado no documento
     */
    private async insertGeneratedCode(
        document: vscode.TextDocument,
        position: vscode.Position,
        generatedCode: string,
        type: string
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }

        // Determinar posição de inserção baseada no tipo
        let insertPosition = position;
        
        if (type === 'function' || type === 'class') {
            // Inserir após o comentário/declaração
            insertPosition = new vscode.Position(position.line + 1, 0);
        }

        await editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, `\n${generatedCode}\n`);
        });

        // Formatar o código inserido
        await vscode.commands.executeCommand('editor.action.formatDocument');
    }

    /**
     * Constrói prompt para geração de função
     */
    private buildFunctionPrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const context = this.getContextAroundPosition(document, position, 10);
        return `Generate a function implementation based on the JSDoc comment:\n\n${context}`;
    }

    /**
     * Constrói prompt para TODO/FIXME
     */
    private buildTodoPrompt(document: vscode.TextDocument, position: vscode.Position, comment: string): string {
        const context = this.getContextAroundPosition(document, position, 5);
        return `Implement the following TODO/FIXME comment:\n${comment}\n\nContext:\n${context}`;
    }

    /**
     * Constrói prompt para implementação de interface
     */
    private buildInterfacePrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const context = this.getContextAroundPosition(document, position, 15);
        return `Implement the interface methods:\n\n${context}`;
    }

    /**
     * Constrói prompt para classe
     */
    private buildClassPrompt(document: vscode.TextDocument, position: vscode.Position): string {
        const context = this.getContextAroundPosition(document, position, 8);
        return `Generate class implementation skeleton:\n\n${context}`;
    }

    /**
     * Obtém contexto ao redor de uma posição
     */
    private getContextAroundPosition(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        lines: number
    ): string {
        const startLine = Math.max(0, position.line - lines);
        const endLine = Math.min(document.lineCount - 1, position.line + lines);
        
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            context += document.lineAt(i).text + '\n';
        }
        
        return context;
    }

    /**
     * Verifica se é comentário JSDoc
     */
    private isJSDocComment(document: vscode.TextDocument, position: vscode.Position): boolean {
        // Procurar por /** nas linhas anteriores
        for (let i = position.line; i >= Math.max(0, position.line - 5); i--) {
            const line = document.lineAt(i).text.trim();
            if (line.includes('/**')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Verifica se é implementação de interface
     */
    private isInterfaceImplementation(document: vscode.TextDocument, position: vscode.Position): boolean {
        const text = this.getContextAroundPosition(document, position, 10);
        return text.includes('implements ') || text.includes('extends ') || 
               text.includes('interface ') || text.includes('class ');
    }

    /**
     * Verifica se é declaração de classe
     */
    private isClassDeclaration(document: vscode.TextDocument, position: vscode.Position): boolean {
        const line = document.lineAt(position.line).text.trim();
        return line.includes('class ') && line.includes('{');
    }

    /**
     * Analisa documento completo para oportunidades de geração
     */
    private async analyzeDocumentForGeneration(document: vscode.TextDocument): Promise<void> {
        if (!this.isSupportedLanguage(document.languageId)) {
            return;
        }

        // Procurar por comentários TODO/FIXME não implementados
        const todos = this.findUnimplementedTodos(document);
        
        if (todos.length > 0) {
            const message = `xCopilot encontrou ${todos.length} TODO(s) não implementado(s). Gerar implementações?`;
            const choice = await vscode.window.showInformationMessage(message, 'Gerar Todos', 'Ignorar');
            
            if (choice === 'Gerar Todos') {
                await this.generateAllTodos(document, todos);
            }
        }
    }

    /**
     * Encontra TODOs não implementados
     */
    private findUnimplementedTodos(document: vscode.TextDocument): TodoItem[] {
        const todos: TodoItem[] = [];
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.toLowerCase();
            
            if ((text.includes('todo:') || text.includes('fixme:')) && 
                !this.hasImplementationBelow(document, i)) {
                todos.push({
                    line: i,
                    text: line.text.trim(),
                    position: new vscode.Position(i, 0)
                });
            }
        }
        
        return todos;
    }

    /**
     * Verifica se há implementação abaixo do TODO
     */
    private hasImplementationBelow(document: vscode.TextDocument, lineNumber: number): boolean {
        // Verificar próximas 3 linhas por código não-comentário
        for (let i = lineNumber + 1; i < Math.min(document.lineCount, lineNumber + 4); i++) {
            const line = document.lineAt(i).text.trim();
            if (line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('#')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gera implementação para todos os TODOs
     */
    private async generateAllTodos(document: vscode.TextDocument, todos: TodoItem[]): Promise<void> {
        for (const todo of todos) {
            try {
                const generationType: GenerationType = {
                    type: 'implementation',
                    description: 'TODO implementation',
                    prompt: this.buildTodoPrompt(document, todo.position, todo.text)
                };
                
                await this.generateImplementation(document, todo.position, generationType);
                
                // Pequeno delay entre gerações
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                Logger.error(`Error generating TODO at line ${todo.line}:`, error);
            }
        }
    }

    /**
     * Verifica se a linguagem é suportada
     */
    private isSupportedLanguage(languageId: string): boolean {
        const supportedLanguages = [
            'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c',
            'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'dart'
        ];
        return supportedLanguages.includes(languageId);
    }

    /**
     * Habilita/desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        Logger.info(`Multiline generation service ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Dispõe recursos
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        Logger.info('Multiline generation service disposed');
    }
}

interface GenerationType {
    type: string;
    description: string;
    prompt: string;
}

interface TodoItem {
    line: number;
    text: string;
    position: vscode.Position;
}