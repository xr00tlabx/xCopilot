/**
 * Serviço para análise de comentários TODO, FIXME, JSDoc
 */

import * as vscode from 'vscode';
import { CommentAnalysis } from '../types';

export class CommentAnalysisService {
    private static instance: CommentAnalysisService;

    public static getInstance(): CommentAnalysisService {
        if (!CommentAnalysisService.instance) {
            CommentAnalysisService.instance = new CommentAnalysisService();
        }
        return CommentAnalysisService.instance;
    }

    /**
     * Analisa comentários em um documento
     */
    public analyzeDocument(document: vscode.TextDocument): CommentAnalysis[] {
        const analyses: CommentAnalysis[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const analysis = this.analyzeLine(line, i);
            if (analysis) {
                analyses.push(analysis);
            }
        }

        return analyses;
    }

    /**
     * Analisa uma linha específica em busca de comentários
     */
    public analyzeLine(line: string, lineNumber: number): CommentAnalysis | null {
        const trimmedLine = line.trim();

        // TODO comments
        const todoMatch = trimmedLine.match(/\/\/\s*TODO:?\s*(.+)/i) || trimmedLine.match(/#\s*TODO:?\s*(.+)/i);
        if (todoMatch) {
            return this.createCommentAnalysis('TODO', todoMatch[1], lineNumber);
        }

        // FIXME comments
        const fixmeMatch = trimmedLine.match(/\/\/\s*FIXME:?\s*(.+)/i) || trimmedLine.match(/#\s*FIXME:?\s*(.+)/i);
        if (fixmeMatch) {
            return this.createCommentAnalysis('FIXME', fixmeMatch[1], lineNumber);
        }

        // JSDoc comments
        if (trimmedLine.includes('/**') || trimmedLine.includes('*')) {
            const jsdocMatch = trimmedLine.match(/\*\s*(.+)/);
            if (jsdocMatch) {
                return this.createCommentAnalysis('JSDoc', jsdocMatch[1], lineNumber);
            }
        }

        return null;
    }

    /**
     * Extrai intenção e requisitos de um comentário
     */
    private createCommentAnalysis(type: 'TODO' | 'FIXME' | 'JSDoc' | 'CUSTOM', content: string, line: number): CommentAnalysis {
        const intention = this.extractIntention(content);
        const requirements = this.extractRequirements(content);
        const parameters = this.extractParameters(content);
        const returnType = this.extractReturnType(content);

        return {
            type,
            content,
            line,
            intention,
            requirements,
            parameters,
            returnType
        };
    }

    /**
     * Extrai a intenção do desenvolvedor do comentário
     */
    private extractIntention(content: string): string {
        // Remove patterns comuns e foca na intenção
        const cleaned = content
            .replace(/^(implement|create|add|fix|update|refactor)\s*/i, '')
            .replace(/\s*(function|method|class|interface)\s*/i, '')
            .trim();

        return cleaned || content;
    }

    /**
     * Extrai requisitos específicos do comentário
     */
    private extractRequirements(content: string): string[] {
        const requirements: string[] = [];
        
        // Busca por listas ou itens separados por vírgula
        const listMatches = content.match(/(?:should|must|needs?to|requires?)\s+(.+)/gi);
        if (listMatches) {
            listMatches.forEach(match => {
                const requirement = match.replace(/^(?:should|must|needs?to|requires?)\s+/i, '').trim();
                requirements.push(requirement);
            });
        }

        // Busca por parâmetros ou argumentos mencionados
        const paramMatches = content.match(/(?:with|using|takes?|accepts?)\s+(.+?)(?:\s+and|\s*$)/gi);
        if (paramMatches) {
            paramMatches.forEach(match => {
                const requirement = match.replace(/^(?:with|using|takes?|accepts?)\s+/i, '').replace(/\s+and\s*$/, '').trim();
                requirements.push(requirement);
            });
        }

        return requirements;
    }

    /**
     * Extrai parâmetros mencionados no comentário
     */
    private extractParameters(content: string): string[] {
        const parameters: string[] = [];
        
        // Busca por parâmetros em formato (param1, param2)
        const paramListMatch = content.match(/\(([^)]+)\)/);
        if (paramListMatch) {
            const params = paramListMatch[1].split(',').map(p => p.trim());
            parameters.push(...params);
        }

        // Busca por menções de parâmetros específicos
        const paramMentions = content.match(/(?:parameter|param|argument|arg)\s+(\w+)/gi);
        if (paramMentions) {
            paramMentions.forEach(match => {
                const param = match.replace(/^(?:parameter|param|argument|arg)\s+/i, '').trim();
                parameters.push(param);
            });
        }

        return parameters;
    }

    /**
     * Extrai tipo de retorno mencionado no comentário
     */
    private extractReturnType(content: string): string | undefined {
        // Busca por menções de tipo de retorno
        const returnMatches = content.match(/(?:returns?|return type)\s+(\w+)/i);
        if (returnMatches) {
            return returnMatches[1];
        }

        // Busca por tipos comuns mencionados
        const typeMatches = content.match(/\b(string|number|boolean|object|array|Promise|void)\b/i);
        if (typeMatches) {
            return typeMatches[1];
        }

        return undefined;
    }

    /**
     * Encontra todos os comentários TODO/FIXME no workspace
     */
    public async findAllComments(pattern: string = '**/*.{js,ts,py,java}'): Promise<CommentAnalysis[]> {
        const allComments: CommentAnalysis[] = [];
        
        try {
            const files = await vscode.workspace.findFiles(pattern);
            
            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const comments = this.analyzeDocument(document);
                allComments.push(...comments);
            }
        } catch (error) {
            console.error('Error finding comments:', error);
        }

        return allComments;
    }

    /**
     * Verifica se uma linha contém um comentário de implementação
     */
    public isImplementationComment(line: string): boolean {
        const implementationKeywords = [
            'TODO', 'FIXME', 'implement', 'create', 'add',
            'generate', 'build', 'make', 'write'
        ];

        const lowerLine = line.toLowerCase();
        return implementationKeywords.some(keyword => 
            lowerLine.includes(keyword.toLowerCase())
        );
    }

    /**
     * Detecta o tipo de implementação necessária baseado no comentário
     */
    public detectImplementationType(analysis: CommentAnalysis): 'function' | 'class' | 'interface' | 'method' | 'variable' | 'unknown' {
        const content = analysis.content.toLowerCase();

        if (content.includes('function') || content.includes('method')) {
            return 'function';
        }
        if (content.includes('class')) {
            return 'class';
        }
        if (content.includes('interface')) {
            return 'interface';
        }
        if (content.includes('variable') || content.includes('constant')) {
            return 'variable';
        }
        if (analysis.parameters && analysis.parameters.length > 0) {
            return 'function';
        }

        return 'unknown';
    }
}