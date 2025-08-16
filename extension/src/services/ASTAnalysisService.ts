/**
 * Serviço para análise AST do código TypeScript
 */

import * as vscode from 'vscode';
import { ASTAnalysis, ClassInfo, FunctionInfo, InterfaceInfo, MethodInfo, ParameterInfo, PropertyInfo } from '../types';

export class ASTAnalysisService {
    private static instance: ASTAnalysisService;

    public static getInstance(): ASTAnalysisService {
        if (!ASTAnalysisService.instance) {
            ASTAnalysisService.instance = new ASTAnalysisService();
        }
        return ASTAnalysisService.instance;
    }

    /**
     * Analisa um documento TypeScript/JavaScript
     */
    public analyzeDocument(document: vscode.TextDocument): ASTAnalysis {
        const text = document.getText();
        const lines = text.split('\n');

        const analysis: ASTAnalysis = {
            imports: this.extractImports(lines),
            interfaces: this.extractInterfaces(lines),
            classes: this.extractClasses(lines),
            functions: this.extractFunctions(lines),
            patterns: this.detectPatterns(lines),
            suggestions: []
        };

        analysis.suggestions = this.generateSuggestions(analysis);

        return analysis;
    }

    /**
     * Extrai imports do código
     */
    private extractImports(lines: string[]): string[] {
        const imports: string[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // ES6 imports
            const importMatch = trimmed.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?$/);
            if (importMatch) {
                imports.push(importMatch[2]);
                continue;
            }

            // CommonJS requires
            const requireMatch = trimmed.match(/(?:const|let|var)\s+.+?\s*=\s*require\(['"](.+?)['"]\)/);
            if (requireMatch) {
                imports.push(requireMatch[1]);
            }
        }

        return [...new Set(imports)]; // Remove duplicates
    }

    /**
     * Extrai interfaces do código
     */
    private extractInterfaces(lines: string[]): InterfaceInfo[] {
        const interfaces: InterfaceInfo[] = [];
        let currentInterface: InterfaceInfo | null = null;
        let braceLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detecta início de interface
            const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{?/);
            if (interfaceMatch) {
                currentInterface = {
                    name: interfaceMatch[1],
                    properties: [],
                    methods: [],
                    isEmpty: true,
                    line: i
                };
                braceLevel = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                continue;
            }

            if (currentInterface) {
                braceLevel += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

                // Extrai propriedades e métodos
                if (braceLevel > 0 && line && !line.startsWith('//') && !line.startsWith('*')) {
                    const property = this.parseProperty(line);
                    if (property) {
                        currentInterface.properties.push(property);
                        currentInterface.isEmpty = false;
                    }

                    const method = this.parseMethod(line);
                    if (method) {
                        currentInterface.methods.push(method);
                        currentInterface.isEmpty = false;
                    }
                }

                // Fim da interface
                if (braceLevel <= 0) {
                    currentInterface.endLine = i;
                    interfaces.push(currentInterface);
                    currentInterface = null;
                }
            }
        }

        return interfaces;
    }

    /**
     * Extrai classes do código
     */
    private extractClasses(lines: string[]): ClassInfo[] {
        const classes: ClassInfo[] = [];
        let currentClass: ClassInfo | null = null;
        let braceLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detecta início de classe
            const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{?/);
            if (classMatch) {
                currentClass = {
                    name: classMatch[1],
                    extends: classMatch[2],
                    implements: classMatch[3] ? classMatch[3].split(',').map(i => i.trim()) : undefined,
                    properties: [],
                    methods: [],
                    constructor: undefined,
                    line: i
                };
                braceLevel = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                continue;
            }

            if (currentClass) {
                braceLevel += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

                // Extrai propriedades e métodos
                if (braceLevel > 0 && line && !line.startsWith('//') && !line.startsWith('*')) {
                    const property = this.parseProperty(line);
                    if (property) {
                        currentClass.properties.push(property);
                    }

                    const method = this.parseMethod(line);
                    if (method) {
                        currentClass.methods.push(method);
                    }

                    // Detecta constructor
                    if (line.includes('constructor')) {
                        currentClass.constructor = this.parseConstructor(line);
                    }
                }

                // Fim da classe
                if (braceLevel <= 0) {
                    currentClass.endLine = i;
                    classes.push(currentClass);
                    currentClass = null;
                }
            }
        }

        return classes;
    }

    /**
     * Extrai funções do código
     */
    private extractFunctions(lines: string[]): FunctionInfo[] {
        const functions: FunctionInfo[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Function declarations
            const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)(?:\s*:\s*([^{]+))?\s*\{?/);
            if (funcMatch) {
                functions.push({
                    name: funcMatch[1],
                    parameters: this.parseParameters(funcMatch[2]),
                    returnType: funcMatch[3]?.trim(),
                    isAsync: line.includes('async'),
                    isExported: line.includes('export'),
                    hasImplementation: true,
                    line: i
                });
                continue;
            }

            // Arrow functions
            const arrowMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\((.*?)\)(?:\s*:\s*([^=]+))?\s*=>/);
            if (arrowMatch) {
                functions.push({
                    name: arrowMatch[1],
                    parameters: this.parseParameters(arrowMatch[2]),
                    returnType: arrowMatch[3]?.trim(),
                    isAsync: line.includes('async'),
                    isExported: line.includes('export'),
                    hasImplementation: true,
                    line: i,
                    endLine: i
                });
            }
        }

        return functions;
    }

    /**
     * Detecta padrões arquiteturais no código
     */
    private detectPatterns(lines: string[]): string[] {
        const patterns: Set<string> = new Set();
        const text = lines.join('\n').toLowerCase();

        // Padrões comuns
        const patternDetectors = [
            { pattern: 'Repository', keywords: ['repository', 'findById', 'save', 'delete'] },
            { pattern: 'Factory', keywords: ['factory', 'create', 'build'] },
            { pattern: 'Singleton', keywords: ['getInstance', 'instance', 'singleton'] },
            { pattern: 'Observer', keywords: ['subscribe', 'observer', 'notify', 'emit'] },
            { pattern: 'Strategy', keywords: ['strategy', 'algorithm', 'execute'] },
            { pattern: 'CRUD', keywords: ['create', 'read', 'update', 'delete', 'findAll'] },
            { pattern: 'MVC', keywords: ['controller', 'model', 'view'] },
            { pattern: 'Service', keywords: ['service', 'business logic', 'usecase'] },
            { pattern: 'DTO', keywords: ['dto', 'data transfer', 'request', 'response'] },
            { pattern: 'Decorator', keywords: ['decorator', '@', 'wrapper'] }
        ];

        for (const detector of patternDetectors) {
            const matchCount = detector.keywords.filter(keyword => text.includes(keyword)).length;
            if (matchCount >= 2) {
                patterns.add(detector.pattern);
            }
        }

        return Array.from(patterns);
    }

    /**
     * Gera sugestões baseadas na análise
     */
    private generateSuggestions(analysis: ASTAnalysis): string[] {
        const suggestions: string[] = [];

        // Sugestões para interfaces vazias
        const emptyInterfaces = analysis.interfaces.filter(i => i.isEmpty);
        if (emptyInterfaces.length > 0) {
            suggestions.push(`Found ${emptyInterfaces.length} empty interface(s). Consider implementing them.`);
        }

        // Sugestões para classes sem métodos
        const classesWithoutMethods = analysis.classes.filter(c => c.methods.length === 0);
        if (classesWithoutMethods.length > 0) {
            suggestions.push(`Found ${classesWithoutMethods.length} class(es) without methods. Consider adding functionality.`);
        }

        // Sugestões baseadas em padrões
        if (analysis.patterns.includes('CRUD') && !analysis.patterns.includes('Repository')) {
            suggestions.push('Consider implementing Repository pattern for better data access abstraction.');
        }

        if (analysis.classes.length > 0 && !analysis.patterns.includes('Factory')) {
            suggestions.push('Consider using Factory pattern for complex object creation.');
        }

        // Sugestões para funções sem implementação
        const functionsWithoutImpl = analysis.functions.filter(f => !f.hasImplementation);
        if (functionsWithoutImpl.length > 0) {
            suggestions.push(`Found ${functionsWithoutImpl.length} function(s) without implementation.`);
        }

        return suggestions;
    }

    /**
     * Extrai informações de uma propriedade
     */
    private parseProperty(line: string): PropertyInfo | null {
        // Remove modifiers and extract property info
        const cleanLine = line.replace(/^(private|protected|public|readonly|static)\s+/, '');
        
        const propertyMatch = cleanLine.match(/^(\w+)(\?)?\s*:\s*([^;=]+)/);
        if (propertyMatch) {
            return {
                name: propertyMatch[1],
                type: propertyMatch[3].trim(),
                isOptional: !!propertyMatch[2],
                isReadonly: line.includes('readonly')
            };
        }

        return null;
    }

    /**
     * Extrai informações de um método
     */
    private parseMethod(line: string): MethodInfo | null {
        // Regex: handles multiple/optional modifiers, async, method name, params, return type
        const methodMatch = line.match(/^(?:(?:private|protected|public|static|abstract|readonly)\s+)*\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{{;=]+))?\s*(?:\{|;)?/);
        if (methodMatch) {
            return {
                name: methodMatch[1],
                parameters: this.parseParameters(methodMatch[2]),
                returnType: methodMatch[3]?.trim(),
                isAsync: line.includes('async'),
                isAbstract: line.includes('abstract'),
                hasImplementation: line.includes('{') || !line.includes(';')
            };
        }

        return null;
    }

    /**
     * Extrai informações do constructor
     */
    private parseConstructor(line: string): MethodInfo {
        const paramMatch = line.match(/constructor\s*\((.*?)\)/);
        const parameters = paramMatch ? this.parseParameters(paramMatch[1]) : [];

        return {
            name: 'constructor',
            parameters,
            isAsync: false,
            isAbstract: false,
            hasImplementation: line.includes('{')
        };
    }

    /**
     * Extrai parâmetros de uma string
     */
    private parseParameters(paramString: string): ParameterInfo[] {
        if (!paramString.trim()) {
            return [];
        }

        return paramString.split(',').map(param => {
            const trimmed = param.trim();
            const parts = trimmed.split(':').map(p => p.trim());
            const namePart = parts[0];
            const typePart = parts[1];

            // Extract default value
            const defaultMatch = namePart.match(/(\w+)(?:\s*=\s*(.+))?/);
            const name = defaultMatch ? defaultMatch[1] : namePart.replace(/[?=].*/,'').trim();
            const isOptional = namePart.includes('?') || namePart.includes('=');
            const defaultValue = defaultMatch && defaultMatch[2] ? defaultMatch[2] : undefined;

            return {
                name,
                type: typePart,
                isOptional,
                defaultValue
            };
        });
    }

    /**
     * Encontra interfaces vazias em um documento
     */
    public findEmptyInterfaces(document: vscode.TextDocument): InterfaceInfo[] {
        const analysis = this.analyzeDocument(document);
        return analysis.interfaces.filter(i => i.isEmpty);
    }

    /**
     * Encontra funções sem implementação
     */
    public findUnimplementedFunctions(document: vscode.TextDocument): FunctionInfo[] {
        const analysis = this.analyzeDocument(document);
        return analysis.functions.filter(f => !f.hasImplementation);
    }

    /**
     * Detecta o tipo de linguagem do arquivo
     */
    public detectLanguage(document: vscode.TextDocument): 'typescript' | 'javascript' | 'python' | 'java' | 'unknown' {
        const fileName = document.fileName.toLowerCase();
        
        if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
            return 'typescript';
        }
        if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
            return 'javascript';
        }
        if (fileName.endsWith('.py')) {
            return 'python';
        }
        if (fileName.endsWith('.java')) {
            return 'java';
        }

        return 'unknown';
    }

    /**
     * Obtém contexto semântico em uma posição específica
     */
    public getSemanticContext(document: vscode.TextDocument, position: vscode.Position): {
        insideClass?: string;
        insideFunction?: string;
        insideInterface?: string;
        availableTypes: string[];
        nearbySymbols: string[];
    } {
        const analysis = this.analyzeDocument(document);
        const line = position.line;

        const context = {
            availableTypes: [],
            nearbySymbols: []
        } as any;

        // Determina se está dentro de uma classe
        for (const cls of analysis.classes) {
            if (cls.line <= line && (typeof cls.endLine === 'undefined' || line <= cls.endLine)) {
            // Verifica se ainda está dentro da classe (considerando o fim da classe quando disponível)
                context.insideClass = cls.name;
                context.availableTypes.push(...cls.properties.map(p => p.type).filter(Boolean));
            }
        }

        // Determina se está dentro de uma função
        for (const func of analysis.functions) {
            if (func.line <= line && (typeof func.endLine === 'undefined' || func.endLine >= line)) { // Verifica se está dentro dos limites reais da função
                context.insideFunction = func.name;
            }
        }

        // Adiciona tipos de interfaces
        context.availableTypes.push(...analysis.interfaces.map(i => i.name));
        context.availableTypes.push(...analysis.classes.map(c => c.name));

        // Remove duplicatas
        context.availableTypes = [...new Set(context.availableTypes)];

        return context;
    }
}