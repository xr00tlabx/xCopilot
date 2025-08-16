/**
 * Serviço para geração de código com templates para padrões comuns
 */

import { CodeTemplate, CodeGenerationRequest, CodeGenerationResult, CommentAnalysis } from '../types';

export class CodeGenerationService {
    private static instance: CodeGenerationService;
    private templates: Map<string, CodeTemplate> = new Map();

    public static getInstance(): CodeGenerationService {
        if (!CodeGenerationService.instance) {
            CodeGenerationService.instance = new CodeGenerationService();
            CodeGenerationService.instance.initializeTemplates();
        }
        return CodeGenerationService.instance;
    }

    /**
     * Inicializa templates padrão
     */
    private initializeTemplates(): void {
        // TypeScript/JavaScript Templates
        this.addTemplate({
            id: 'ts-function',
            name: 'TypeScript Function',
            description: 'Gera uma função TypeScript com tipos',
            pattern: 'Function',
            language: 'typescript',
            template: `/**
 * {{description}}
 * {{#each params}}
 * @param {{{type}}} {{name}} - {{description}}
 * {{/each}}
 * @returns {{{returnType}}} {{returnDescription}}
 */
{{#if isAsync}}async {{/if}}function {{name}}({{#each params}}{{name}}{{#if type}}: {{type}}{{/if}}{{#unless @last}}, {{/unless}}{{/each}}){{#if returnType}}: {{returnType}}{{/if}} {
    {{#if isAsync}}
    // TODO: Implement async logic
    {{else}}
    // TODO: Implement function logic
    {{/if}}
    {{#if returnType}}
    {{#unless (eq returnType 'void')}}
    return {{defaultReturn}};
    {{/unless}}
    {{/if}}
}`,
            variables: ['name', 'description', 'params', 'returnType', 'isAsync', 'returnDescription', 'defaultReturn']
        });

        this.addTemplate({
            id: 'ts-class',
            name: 'TypeScript Class',
            description: 'Gera uma classe TypeScript completa',
            pattern: 'Class',
            language: 'typescript',
            template: `/**
 * {{description}}
 */
export class {{name}}{{#if extends}} extends {{extends}}{{/if}}{{#if implements}} implements {{implements}}{{/if}} {
    {{#each properties}}
    {{#if isPrivate}}private {{/if}}{{#if isProtected}}protected {{/if}}{{#if isReadonly}}readonly {{/if}}{{name}}{{#if isOptional}}?{{/if}}{{#if type}}: {{type}}{{/if}};
    {{/each}}

    constructor({{#each constructorParams}}{{name}}{{#if type}}: {{type}}{{/if}}{{#unless @last}}, {{/unless}}{{/each}}) {
        {{#if extends}}
        super({{#each superParams}}{{name}}{{#unless @last}}, {{/unless}}{{/each}});
        {{/if}}
        {{#each constructorParams}}
        this.{{name}} = {{name}};
        {{/each}}
    }

    {{#each methods}}
    /**
     * {{description}}
     */
    {{#if isPrivate}}private {{/if}}{{#if isProtected}}protected {{/if}}{{#if isAsync}}async {{/if}}{{name}}({{#each params}}{{name}}{{#if type}}: {{type}}{{/if}}{{#unless @last}}, {{/unless}}{{/each}}){{#if returnType}}: {{returnType}}{{/if}} {
        // TODO: Implement {{name}} logic
        {{#if returnType}}
        {{#unless (eq returnType 'void')}}
        return {{defaultReturn}};
        {{/unless}}
        {{/if}}
    }

    {{/each}}
}`,
            variables: ['name', 'description', 'extends', 'implements', 'properties', 'constructorParams', 'methods']
        });

        this.addTemplate({
            id: 'ts-interface',
            name: 'TypeScript Interface',
            description: 'Implementa uma interface TypeScript',
            pattern: 'Interface',
            language: 'typescript',
            template: `/**
 * Implementation of {{interfaceName}}
 */
export class {{className}} implements {{interfaceName}} {
    {{#each properties}}
    {{name}}{{#if isOptional}}?{{/if}}: {{type}};
    {{/each}}

    {{#each methods}}
    {{#if isAsync}}async {{/if}}{{name}}({{#each params}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): {{returnType}} {
        // TODO: Implement {{name}}
        {{#if returnType}}
        {{#unless (eq returnType 'void')}}
        throw new Error('Method {{name}} not implemented');
        {{/unless}}
        {{/if}}
    }

    {{/each}}
}`,
            variables: ['className', 'interfaceName', 'properties', 'methods']
        });

        this.addTemplate({
            id: 'ts-crud-service',
            name: 'CRUD Service',
            description: 'Gera um serviço CRUD completo',
            pattern: 'CRUD',
            language: 'typescript',
            template: `/**
 * CRUD Service for {{entityName}}
 */
export class {{entityName}}Service {
    private repository: {{entityName}}Repository;

    constructor(repository: {{entityName}}Repository) {
        this.repository = repository;
    }

    /**
     * Create a new {{entityName}}
     */
    async create(data: Create{{entityName}}Dto): Promise<{{entityName}}> {
        const entity = new {{entityName}}(data);
        return await this.repository.save(entity);
    }

    /**
     * Find {{entityName}} by ID
     */
    async findById(id: string): Promise<{{entityName}} | null> {
        return await this.repository.findById(id);
    }

    /**
     * Find all {{entityName}}s
     */
    async findAll(options?: FindOptions): Promise<{{entityName}}[]> {
        return await this.repository.findAll(options);
    }

    /**
     * Update {{entityName}}
     */
    async update(id: string, data: Update{{entityName}}Dto): Promise<{{entityName}} | null> {
        const entity = await this.repository.findById(id);
        if (!entity) {
            return null;
        }
        
        Object.assign(entity, data);
        return await this.repository.save(entity);
    }

    /**
     * Delete {{entityName}}
     */
    async delete(id: string): Promise<boolean> {
        return await this.repository.delete(id);
    }
}`,
            variables: ['entityName']
        });

        this.addTemplate({
            id: 'ts-repository',
            name: 'Repository Pattern',
            description: 'Gera um repositório com padrão Repository',
            pattern: 'Repository',
            language: 'typescript',
            template: `/**
 * Repository for {{entityName}}
 */
export interface {{entityName}}Repository {
    save(entity: {{entityName}}): Promise<{{entityName}}>;
    findById(id: string): Promise<{{entityName}} | null>;
    findAll(options?: FindOptions): Promise<{{entityName}}[]>;
    delete(id: string): Promise<boolean>;
}

/**
 * In-memory implementation of {{entityName}}Repository
 */
export class InMemory{{entityName}}Repository implements {{entityName}}Repository {
    private entities: Map<string, {{entityName}}> = new Map();

    async save(entity: {{entityName}}): Promise<{{entityName}}> {
        this.entities.set(entity.id, entity);
        return entity;
    }

    async findById(id: string): Promise<{{entityName}} | null> {
        return this.entities.get(id) || null;
    }

    async findAll(options?: FindOptions): Promise<{{entityName}}[]> {
        return Array.from(this.entities.values());
    }

    async delete(id: string): Promise<boolean> {
        return this.entities.delete(id);
    }
}`,
            variables: ['entityName']
        });

        // Python Templates
        this.addTemplate({
            id: 'py-function',
            name: 'Python Function',
            description: 'Gera uma função Python com type hints',
            pattern: 'Function',
            language: 'python',
            template: `def {{name}}({{#each params}}{{name}}{{#if type}}: {{type}}{{/if}}{{#if defaultValue}} = {{defaultValue}}{{/if}}{{#unless @last}}, {{/unless}}{{/each}}){{#if returnType}} -> {{returnType}}{{/if}}:
    """
    {{description}}
    
    {{#each params}}
    Args:
        {{name}} ({{type}}): {{description}}
    {{/each}}
    
    Returns:
        {{returnType}}: {{returnDescription}}
    """
    # TODO: Implement function logic
    {{#if returnType}}
    {{#unless (eq returnType 'None')}}
    pass  # Replace with actual implementation
    {{/unless}}
    {{/if}}`,
            variables: ['name', 'description', 'params', 'returnType', 'returnDescription']
        });

        this.addTemplate({
            id: 'py-class',
            name: 'Python Class',
            description: 'Gera uma classe Python completa',
            pattern: 'Class',
            language: 'python',
            template: `class {{name}}{{#if extends}}({{extends}}){{/if}}:
    """{{description}}"""
    
    def __init__(self{{#each constructorParams}}, {{name}}{{#if type}}: {{type}}{{/if}}{{/each}}):
        """Initialize {{name}}"""
        {{#if extends}}
        super().__init__({{#each superParams}}{{name}}{{#unless @last}}, {{/unless}}{{/each}})
        {{/if}}
        {{#each constructorParams}}
        self.{{name}} = {{name}}
        {{/each}}
    
    {{#each methods}}
    def {{name}}(self{{#each params}}, {{name}}{{#if type}}: {{type}}{{/if}}{{/each}}){{#if returnType}} -> {{returnType}}{{/if}}:
        """{{description}}"""
        # TODO: Implement {{name}} logic
        {{#if returnType}}
        {{#unless (eq returnType 'None')}}
        pass  # Replace with actual implementation
        {{/unless}}
        {{/if}}
    
    {{/each}}`,
            variables: ['name', 'description', 'extends', 'constructorParams', 'methods']
        });

        // Java Templates
        this.addTemplate({
            id: 'java-class',
            name: 'Java Class',
            description: 'Gera uma classe Java completa',
            pattern: 'Class',
            language: 'java',
            template: `/**
 * {{description}}
 */
public class {{name}}{{#if extends}} extends {{extends}}{{/if}}{{#if implements}} implements {{implements}}{{/if}} {
    
    {{#each fields}}
    private {{type}} {{name}};
    {{/each}}
    
    /**
     * Constructor for {{name}}
     */
    public {{name}}({{#each constructorParams}}{{type}} {{name}}{{#unless @last}}, {{/unless}}{{/each}}) {
        {{#if extends}}
        super({{#each superParams}}{{name}}{{#unless @last}}, {{/unless}}{{/each}});
        {{/if}}
        {{#each constructorParams}}
        this.{{name}} = {{name}};
        {{/each}}
    }
    
    {{#each methods}}
    /**
     * {{description}}
     */
    public {{returnType}} {{name}}({{#each params}}{{type}} {{name}}{{#unless @last}}, {{/unless}}{{/each}}) {
        // TODO: Implement {{name}} logic
        {{#if returnType}}
        {{#unless (eq returnType 'void')}}
        return null; // Replace with actual implementation
        {{/unless}}
        {{/if}}
    }
    
    {{/each}}
    
    {{#each fields}}
    // Getter and Setter for {{name}}
    public {{type}} get{{capitalize name}}() {
        return this.{{name}};
    }
    
    public void set{{capitalize name}}({{type}} {{name}}) {
        this.{{name}} = {{name}};
    }
    
    {{/each}}
}`,
            variables: ['name', 'description', 'extends', 'implements', 'fields', 'constructorParams', 'methods']
        });
    }

    /**
     * Adiciona um template
     */
    public addTemplate(template: CodeTemplate): void {
        this.templates.set(template.id, template);
    }

    /**
     * Obtém um template por ID
     */
    public getTemplate(id: string): CodeTemplate | undefined {
        return this.templates.get(id);
    }

    /**
     * Lista templates por linguagem
     */
    public getTemplatesByLanguage(language: string): CodeTemplate[] {
        return Array.from(this.templates.values()).filter(t => t.language === language);
    }

    /**
     * Lista templates por padrão
     */
    public getTemplatesByPattern(pattern: string): CodeTemplate[] {
        return Array.from(this.templates.values()).filter(t => t.pattern === pattern);
    }

    /**
     * Gera código baseado em um comentário analisado
     */
    public async generateFromComment(analysis: CommentAnalysis, language: string): Promise<CodeGenerationResult> {
        try {
            const implementationType = this.detectImplementationType(analysis);
            const template = this.selectBestTemplate(implementationType, language);
            
            if (!template) {
                return {
                    success: false,
                    code: '',
                    description: 'Template not found',
                    language,
                    error: `No template found for ${implementationType} in ${language}`
                };
            }

            const variables = this.extractVariablesFromComment(analysis);
            const code = this.renderTemplate(template, variables);

            return {
                success: true,
                code,
                description: `Generated ${implementationType} from comment: ${analysis.intention}`,
                language,
                insertPosition: {
                    line: analysis.line + 1,
                    character: 0
                }
            };

        } catch (error) {
            return {
                success: false,
                code: '',
                description: 'Generation failed',
                language,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Gera código baseado em uma solicitação específica
     */
    public async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
        try {
            const template = request.template || this.selectBestTemplate(request.type, request.language);
            
            if (!template) {
                return {
                    success: false,
                    code: '',
                    description: 'Template not found',
                    language: request.language,
                    error: `No template found for ${request.type} in ${request.language}`
                };
            }

            const variables = this.extractVariablesFromRequest(request);
            const code = this.renderTemplate(template, variables);

            return {
                success: true,
                code,
                description: `Generated ${request.type} code`,
                language: request.language
            };

        } catch (error) {
            return {
                success: false,
                code: '',
                description: 'Generation failed',
                language: request.language,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Detecta o tipo de implementação baseado no comentário
     */
    private detectImplementationType(analysis: CommentAnalysis): string {
        const content = analysis.content.toLowerCase();

        if (content.includes('function') || content.includes('method')) {
            return 'Function';
        }
        if (content.includes('class')) {
            return 'Class';
        }
        if (content.includes('interface')) {
            return 'Interface';
        }
        if (content.includes('crud') || content.includes('service')) {
            return 'CRUD';
        }
        if (content.includes('repository')) {
            return 'Repository';
        }
        if (analysis.parameters && analysis.parameters.length > 0) {
            return 'Function';
        }

        return 'Function'; // Default
    }

    /**
     * Seleciona o melhor template baseado no tipo e linguagem
     */
    private selectBestTemplate(type: string, language: string): CodeTemplate | undefined {
        const templates = this.getTemplatesByLanguage(language);
        
        // Busca por padrão exato
        let template = templates.find(t => t.pattern === type);
        
        // Se não encontrar, busca por padrão similar
        if (!template) {
            const typeKey = `${language.substring(0, 2)}-${type.toLowerCase()}`;
            template = this.templates.get(typeKey);
        }

        // Fallback para template de função
        if (!template) {
            template = templates.find(t => t.pattern === 'Function');
        }

        return template;
    }

    /**
     * Extrai variáveis de um comentário analisado
     */
    private extractVariablesFromComment(analysis: CommentAnalysis): Record<string, any> {
        const variables: Record<string, any> = {
            name: this.extractFunctionName(analysis.content),
            description: analysis.intention,
            params: this.convertParametersToTemplateFormat(analysis.parameters || []),
            returnType: analysis.returnType || 'void',
            isAsync: analysis.content.toLowerCase().includes('async'),
            returnDescription: `Result of ${analysis.intention}`,
            defaultReturn: this.getDefaultReturn(analysis.returnType)
        };

        return variables;
    }

    /**
     * Extrai variáveis de uma solicitação de geração
     */
    private extractVariablesFromRequest(request: CodeGenerationRequest): Record<string, any> {
        const variables: Record<string, any> = {
            name: 'GeneratedCode',
            description: request.specification || 'Generated code',
            params: [],
            returnType: 'void',
            isAsync: false
        };

        // Extrai mais informações do contexto se disponível
        if (request.context.selectedText) {
            const name = this.extractFunctionName(request.context.selectedText);
            if (name) {
                variables.name = name;
            }
        }

        return variables;
    }

    /**
     * Extrai nome de função de um texto
     */
    private extractFunctionName(text: string): string {
        // Busca por padrões de nome de função
        const patterns = [
            /function\s+(\w+)/i,
            /def\s+(\w+)/i,
            /(\w+)\s*\(/,
            /create\s+(\w+)/i,
            /implement\s+(\w+)/i,
            /\b(\w+)\s+function/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return 'generatedFunction';
    }

    /**
     * Converte parâmetros para formato de template
     */
    private convertParametersToTemplateFormat(parameters: string[]): Array<{name: string, type?: string, description?: string}> {
        return parameters.map(param => {
            const parts = param.split(':').map(p => p.trim());
            return {
                name: parts[0],
                type: parts[1] || 'any',
                description: `Parameter ${parts[0]}`
            };
        });
    }

    /**
     * Obtém valor de retorno padrão baseado no tipo
     */
    private getDefaultReturn(returnType?: string): string {
        if (!returnType || returnType === 'void') {
            return '';
        }

        const defaults: Record<string, string> = {
            'string': "''",
            'number': '0',
            'boolean': 'false',
            'array': '[]',
            'object': '{}',
            'Promise': 'Promise.resolve()',
            'null': 'null',
            'undefined': 'undefined'
        };

        return defaults[returnType] || 'null';
    }

    /**
     * Renderiza um template com variáveis (implementação simples)
     */
    private renderTemplate(template: CodeTemplate, variables: Record<string, any>): string {
        let result = template.template;

        // Substitui variáveis simples {{variable}}
        Object.keys(variables).forEach(key => {
            const value = variables[key];
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            
            if (typeof value === 'string') {
                result = result.replace(regex, value);
            } else if (Array.isArray(value)) {
                // Para arrays, renderiza cada item
                const arrayString = value.map(item => 
                    typeof item === 'object' ? JSON.stringify(item) : String(item)
                ).join(', ');
                result = result.replace(regex, arrayString);
            } else {
                result = result.replace(regex, String(value));
            }
        });

        // Remove templates não resolvidos
        result = result.replace(/\{\{[^}]+\}\}/g, '');
        
        // Remove linhas vazias excessivas
        result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

        return result.trim();
    }
}