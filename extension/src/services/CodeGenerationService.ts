import * as vscode from 'vscode';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { Logger } from '../utils/Logger';

/**
 * Interface para templates de geração de código
 */
interface CodeTemplate {
    id: string;
    name: string;
    description: string;
    languages: string[];
    pattern: string;
    variables: string[];
}

/**
 * Interface para resultado de geração de código
 */
interface CodeGenerationResult {
    code: string;
    description: string;
    insertPosition?: vscode.Position;
    replaceRange?: vscode.Range;
}

/**
 * Serviço para geração de código multi-linha
 */
export class CodeGenerationService {
    private backendService: BackendService;
    private contextService: CodeContextService;
    private templates: Map<string, CodeTemplate> = new Map();

    constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.initializeTemplates();
    }

    /**
     * Inicializa templates pré-definidos
     */
    private initializeTemplates(): void {
        const templates: CodeTemplate[] = [
            {
                id: 'crud-service',
                name: 'CRUD Service',
                description: 'Generates a complete CRUD service class',
                languages: ['typescript', 'javascript'],
                pattern: 'service',
                variables: ['entityName', 'tableName']
            },
            {
                id: 'repository-pattern',
                name: 'Repository Pattern',
                description: 'Generates repository interface and implementation',
                languages: ['typescript', 'javascript', 'java', 'csharp'],
                pattern: 'repository',
                variables: ['entityName']
            },
            {
                id: 'rest-controller',
                name: 'REST Controller',
                description: 'Generates RESTful API controller',
                languages: ['typescript', 'javascript', 'java', 'csharp'],
                pattern: 'controller',
                variables: ['resourceName']
            },
            {
                id: 'model-class',
                name: 'Model Class',
                description: 'Generates data model with properties and methods',
                languages: ['typescript', 'javascript', 'java', 'csharp', 'python'],
                pattern: 'model',
                variables: ['className', 'properties']
            },
            {
                id: 'unit-tests',
                name: 'Unit Tests',
                description: 'Generates comprehensive unit tests',
                languages: ['typescript', 'javascript', 'java', 'csharp', 'python'],
                pattern: 'tests',
                variables: ['className', 'methodName']
            }
        ];

        templates.forEach(template => {
            this.templates.set(template.id, template);
        });

        Logger.info(`✅ Initialized ${templates.length} code generation templates`);
    }

    /**
     * Registra comandos do VS Code
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            vscode.commands.registerCommand(
                'xcopilot.generateImplementation',
                () => this.generateImplementation()
            ),
            vscode.commands.registerCommand(
                'xcopilot.generateFromComment',
                () => this.generateFromComment()
            ),
            vscode.commands.registerCommand(
                'xcopilot.implementInterface',
                () => this.implementInterface()
            ),
            vscode.commands.registerCommand(
                'xcopilot.generateClass',
                () => this.generateClass()
            ),
            vscode.commands.registerCommand(
                'xcopilot.generateTests',
                () => this.generateTests()
            ),
            vscode.commands.registerCommand(
                'xcopilot.scaffoldAPI',
                () => this.scaffoldAPI()
            ),
            vscode.commands.registerCommand(
                'xcopilot.useCodeTemplate',
                () => this.useCodeTemplate()
            )
        ];

        context.subscriptions.push(...commands);
        Logger.info('✅ Code generation commands registered');
    }

    /**
     * Gera implementação baseada em comentários ou seleção
     */
    private async generateImplementation(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const selection = editor.selection;
            const document = editor.document;
            const language = document.languageId;

            // Analisa o contexto para determinar o tipo de geração
            const context = this.contextService.getCurrentContext();
            let inputText = '';
            let generationType = '';

            if (!selection.isEmpty) {
                inputText = document.getText(selection);
                generationType = this.detectGenerationType(inputText, language);
            } else {
                // Procura por comentários próximos ao cursor
                const cursorLine = selection.active.line;
                const nearbyComments = this.findNearbyComments(document, cursorLine);
                
                if (nearbyComments.length > 0) {
                    inputText = nearbyComments.join('\n');
                    generationType = 'comment';
                } else {
                    vscode.window.showWarningMessage('Selecione código ou posicione o cursor próximo a um comentário');
                    return;
                }
            }

            const result = await this.generateCode(inputText, generationType, language, context);
            
            if (result) {
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage('✅ Código gerado com sucesso!');
            }

        } catch (error) {
            Logger.error('Error generating implementation:', error);
            vscode.window.showErrorMessage('Erro ao gerar implementação');
        }
    }

    /**
     * Gera código a partir de comentários TODO/JSDoc
     */
    private async generateFromComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const document = editor.document;
            const cursorLine = editor.selection.active.line;
            const currentLineText = document.lineAt(cursorLine).text;

            // Verifica se a linha atual é um comentário
            if (!this.isCommentLine(currentLineText, document.languageId)) {
                vscode.window.showWarningMessage('Posicione o cursor em uma linha de comentário');
                return;
            }

            const commentText = this.extractCommentText(currentLineText, document.languageId);
            const context = this.contextService.getCurrentContext();

            const result = await this.generateCode(commentText, 'comment', document.languageId, context);
            
            if (result) {
                // Insere o código na linha seguinte ao comentário
                const insertPosition = new vscode.Position(cursorLine + 1, 0);
                result.insertPosition = insertPosition;
                
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage('✅ Código gerado a partir do comentário!');
            }

        } catch (error) {
            Logger.error('Error generating from comment:', error);
            vscode.window.showErrorMessage('Erro ao gerar código a partir do comentário');
        }
    }

    /**
     * Implementa automaticamente uma interface
     */
    private async implementInterface(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showWarningMessage('Selecione a interface para implementar');
                return;
            }

            const interfaceText = editor.document.getText(selection);
            const language = editor.document.languageId;
            const context = this.contextService.getCurrentContext();

            const result = await this.generateCode(interfaceText, 'interface', language, context);
            
            if (result) {
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage('✅ Interface implementada com sucesso!');
            }

        } catch (error) {
            Logger.error('Error implementing interface:', error);
            vscode.window.showErrorMessage('Erro ao implementar interface');
        }
    }

    /**
     * Gera uma classe completa com construtor e métodos
     */
    private async generateClass(): Promise<void> {
        const className = await vscode.window.showInputBox({
            prompt: 'Nome da classe',
            placeHolder: 'Ex: UserService, ProductManager'
        });

        if (!className) return;

        const classType = await vscode.window.showQuickPick([
            'Service Class',
            'Model Class',
            'Controller Class',
            'Repository Class',
            'Utility Class'
        ], {
            placeHolder: 'Selecione o tipo de classe'
        });

        if (!classType) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const language = editor.document.languageId;
            const context = this.contextService.getCurrentContext();
            
            const prompt = `Generate a ${classType} named ${className}`;
            const result = await this.generateCode(prompt, 'class', language, context);
            
            if (result) {
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage(`✅ Classe ${className} gerada com sucesso!`);
            }

        } catch (error) {
            Logger.error('Error generating class:', error);
            vscode.window.showErrorMessage('Erro ao gerar classe');
        }
    }

    /**
     * Gera testes unitários para código selecionado
     */
    private async generateTests(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Selecione o código para gerar testes');
            return;
        }

        try {
            const selectedCode = editor.document.getText(selection);
            const language = editor.document.languageId;
            const context = this.contextService.getCurrentContext();

            const result = await this.generateCode(selectedCode, 'tests', language, context);
            
            if (result) {
                // Cria um novo arquivo de teste
                const testFileName = this.generateTestFileName(editor.document.fileName, language);
                const testDocument = await vscode.workspace.openTextDocument({
                    content: result.code,
                    language: language
                });
                
                await vscode.window.showTextDocument(testDocument);
                vscode.window.showInformationMessage('✅ Testes unitários gerados com sucesso!');
            }

        } catch (error) {
            Logger.error('Error generating tests:', error);
            vscode.window.showErrorMessage('Erro ao gerar testes');
        }
    }

    /**
     * Scaffolding de API REST/GraphQL
     */
    private async scaffoldAPI(): Promise<void> {
        const apiType = await vscode.window.showQuickPick([
            'REST API Controller',
            'GraphQL Resolver',
            'Express Routes',
            'FastAPI Endpoints'
        ], {
            placeHolder: 'Selecione o tipo de API'
        });

        if (!apiType) return;

        const resourceName = await vscode.window.showInputBox({
            prompt: 'Nome do recurso',
            placeHolder: 'Ex: User, Product, Order'
        });

        if (!resourceName) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const language = editor.document.languageId;
            const context = this.contextService.getCurrentContext();
            
            const prompt = `Generate ${apiType} for ${resourceName} resource`;
            const result = await this.generateCode(prompt, 'api', language, context);
            
            if (result) {
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage(`✅ ${apiType} para ${resourceName} gerado com sucesso!`);
            }

        } catch (error) {
            Logger.error('Error scaffolding API:', error);
            vscode.window.showErrorMessage('Erro ao gerar API');
        }
    }

    /**
     * Usa template pré-definido
     */
    private async useCodeTemplate(): Promise<void> {
        const templateItems = Array.from(this.templates.values()).map(template => ({
            label: template.name,
            description: template.description,
            detail: `Linguagens: ${template.languages.join(', ')}`,
            template: template
        }));

        const selectedTemplate = await vscode.window.showQuickPick(templateItems, {
            placeHolder: 'Selecione um template'
        });

        if (!selectedTemplate) return;

        // Coleta variáveis do template
        const variables: Record<string, string> = {};
        for (const variable of selectedTemplate.template.variables) {
            const value = await vscode.window.showInputBox({
                prompt: `Valor para ${variable}`,
                placeHolder: `Digite o valor para ${variable}`
            });
            
            if (!value) return;
            variables[variable] = value;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo encontrado');
            return;
        }

        try {
            const language = editor.document.languageId;
            const context = this.contextService.getCurrentContext();
            
            const result = await this.generateFromTemplate(selectedTemplate.template, variables, language, context);
            
            if (result) {
                await this.insertGeneratedCode(editor, result);
                vscode.window.showInformationMessage(`✅ Template ${selectedTemplate.template.name} aplicado com sucesso!`);
            }

        } catch (error) {
            Logger.error('Error using template:', error);
            vscode.window.showErrorMessage('Erro ao aplicar template');
        }
    }

    /**
     * Gera código usando IA
     */
    private async generateCode(
        input: string,
        type: string,
        language: string,
        context: any
    ): Promise<CodeGenerationResult | null> {
        vscode.window.showInformationMessage('🤖 Gerando código...');

        try {
            // Use specialized generation endpoint instead of general chat
            const response = await this.backendService.makeRequest('/api/generate', {
                input,
                type,
                language,
                context
            });

            if (response && response.code) {
                return {
                    code: response.code,
                    description: `Generated ${type} in ${language} (${response.duration}ms)`
                };
            }

            // Fallback to general endpoint if specialized one fails
            const prompt = this.buildPrompt(input, type, language, context);
            const fallbackResponse = await this.backendService.askQuestion(prompt);
            const code = this.extractCodeFromResponse(fallbackResponse);
            
            return {
                code,
                description: `Generated ${type} in ${language} (fallback)`
            };

        } catch (error) {
            Logger.error('Error generating code:', error);
            throw error;
        }
    }

    /**
     * Gera código a partir de template
     */
    private async generateFromTemplate(
        template: CodeTemplate,
        variables: Record<string, string>,
        language: string,
        context: any
    ): Promise<CodeGenerationResult | null> {
        try {
            // Use specialized endpoint with template variables
            const response = await this.backendService.makeRequest('/api/generate', {
                input: template.description,
                type: 'template',
                language,
                context,
                variables
            });

            if (response && response.code) {
                return {
                    code: response.code,
                    description: `Generated ${template.name} template (${response.duration}ms)`
                };
            }

            // Fallback
            const prompt = this.buildTemplatePrompt(template, variables, language, context);
            const fallbackResponse = await this.backendService.askQuestion(prompt);
            const code = this.extractCodeFromResponse(fallbackResponse);
            
            return {
                code,
                description: `Generated ${template.name} template (fallback)`
            };

        } catch (error) {
            Logger.error('Error generating from template:', error);
            throw error;
        }
    }

    /**
     * Constrói prompt para geração de código
     */
    private buildPrompt(input: string, type: string, language: string, context: any): string {
        const prompts = {
            comment: `
Analise o seguinte comentário e gere a implementação completa em ${language}:

Comentário:
${input}

Contexto do arquivo:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}
- Imports existentes: ${context?.imports?.join(', ') || 'nenhum'}

Gere APENAS o código de implementação, sem explicações:`,

            interface: `
Implemente a seguinte interface completa em ${language}:

Interface:
\`\`\`${language}
${input}
\`\`\`

Contexto:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}

Gere uma implementação completa da interface com:
- Todos os métodos implementados
- Lógica funcional (não apenas stubs)
- Comentários explicativos
- Boas práticas da linguagem

Retorne APENAS o código, sem explicações:`,

            class: `
Gere uma classe completa em ${language} baseada na descrição:

Descrição: ${input}

Contexto:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}

A classe deve incluir:
- Propriedades relevantes
- Construtor com parâmetros
- Métodos públicos e privados necessários
- Documentação JSDoc/comentários
- Validação de entrada onde apropriado
- Tratamento de erros

Retorne APENAS o código da classe:`,

            tests: `
Gere testes unitários completos para o seguinte código ${language}:

Código para testar:
\`\`\`${language}
${input}
\`\`\`

Gere testes que cubram:
- Casos de sucesso
- Casos de erro
- Edge cases
- Validação de entrada
- Mocking quando necessário

Use framework de teste apropriado para ${language} (Jest, Mocha, JUnit, etc.)
Retorne APENAS o código dos testes:`,

            api: `
Gere uma API completa em ${language} baseada na descrição:

Descrição: ${input}

Contexto:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}

Gere:
- Endpoints CRUD completos
- Validação de entrada
- Tratamento de erros
- Documentação de API
- Middleware de autenticação se apropriado
- Serialização/deserialização de dados

Retorne APENAS o código:`,

            default: `
Gere código ${language} completo baseado na entrada:

Entrada: ${input}

Contexto:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}

Analise a entrada e gere o código mais apropriado.
Retorne APENAS o código, bem estruturado e comentado:`
        };

        return prompts[type as keyof typeof prompts] || prompts.default;
    }

    /**
     * Constrói prompt para template
     */
    private buildTemplatePrompt(
        template: CodeTemplate,
        variables: Record<string, string>,
        language: string,
        context: any
    ): string {
        const variableList = Object.entries(variables)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n');

        return `
Gere código ${language} usando o template "${template.name}":

Descrição: ${template.description}
Padrão: ${template.pattern}

Variáveis:
${variableList}

Contexto do arquivo:
- Arquivo: ${context?.fileName || 'desconhecido'}
- Linguagem: ${language}

Gere código completo seguindo as melhores práticas para ${template.pattern} pattern.
Retorne APENAS o código:`;
    }

    /**
     * Extrai código limpo da resposta
     */
    private extractCodeFromResponse(response: string): string {
        // Remove markdown code blocks
        const codeBlockRegex = /```[\w]*\n?([\s\S]*?)\n?```/g;
        const matches = codeBlockRegex.exec(response);
        
        if (matches && matches[1]) {
            return matches[1].trim();
        }

        // Se não encontrar code blocks, retorna a resposta limpa
        return response.trim();
    }

    /**
     * Detecta tipo de geração baseado no input
     */
    private detectGenerationType(input: string, language: string): string {
        if (input.includes('interface ') || input.includes('protocol ')) {
            return 'interface';
        }
        
        if (input.includes('TODO:') || input.includes('FIXME:') || input.includes('//')) {
            return 'comment';
        }
        
        if (input.includes('class ') || input.includes('function ')) {
            return 'class';
        }
        
        return 'default';
    }

    /**
     * Encontra comentários próximos ao cursor
     */
    private findNearbyComments(document: vscode.TextDocument, line: number): string[] {
        const comments: string[] = [];
        const searchRange = 5; // linhas para cima e para baixo

        for (let i = Math.max(0, line - searchRange); i <= Math.min(document.lineCount - 1, line + searchRange); i++) {
            const lineText = document.lineAt(i).text.trim();
            if (this.isCommentLine(lineText, document.languageId)) {
                comments.push(this.extractCommentText(lineText, document.languageId));
            }
        }

        return comments;
    }

    /**
     * Verifica se uma linha é um comentário
     */
    private isCommentLine(line: string, language: string): boolean {
        const trimmed = line.trim();
        
        const commentPrefixes = {
            javascript: ['//', '/*', '*'],
            typescript: ['//', '/*', '*'],
            python: ['#'],
            java: ['//', '/*', '*'],
            csharp: ['//', '/*', '*'],
            cpp: ['//', '/*', '*'],
            go: ['//', '/*', '*'],
            rust: ['//', '/*', '*'],
            php: ['//', '/*', '*', '#'],
            ruby: ['#'],
            swift: ['//', '/*', '*']
        };

        const prefixes = commentPrefixes[language as keyof typeof commentPrefixes] || ['//', '#'];
        return prefixes.some(prefix => trimmed.startsWith(prefix));
    }

    /**
     * Extrai texto do comentário
     */
    private extractCommentText(line: string, language: string): string {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('//')) {
            return trimmed.substring(2).trim();
        }
        
        if (trimmed.startsWith('#')) {
            return trimmed.substring(1).trim();
        }
        
        if (trimmed.startsWith('/*')) {
            return trimmed.substring(2).replace('*/', '').trim();
        }
        
        if (trimmed.startsWith('*')) {
            return trimmed.substring(1).trim();
        }
        
        return trimmed;
    }

    /**
     * Insere código gerado no editor
     */
    private async insertGeneratedCode(editor: vscode.TextEditor, result: CodeGenerationResult): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        
        if (result.replaceRange) {
            // Substitui texto selecionado
            edit.replace(editor.document.uri, result.replaceRange, result.code);
        } else if (result.insertPosition) {
            // Insere em posição específica
            edit.insert(editor.document.uri, result.insertPosition, '\n' + result.code + '\n');
        } else {
            // Insere na posição do cursor
            const position = editor.selection.active;
            edit.insert(editor.document.uri, position, result.code);
        }
        
        await vscode.workspace.applyEdit(edit);
    }

    /**
     * Gera nome de arquivo de teste
     */
    private generateTestFileName(originalFileName: string, language: string): string {
        const extension = language === 'typescript' ? '.ts' : 
                         language === 'javascript' ? '.js' :
                         language === 'python' ? '.py' :
                         language === 'java' ? '.java' : '.test';
        
        const baseName = originalFileName.replace(/\.[^/.]+$/, '');
        return `${baseName}.test${extension}`;
    }
}