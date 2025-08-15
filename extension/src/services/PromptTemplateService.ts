import { PromptTemplate } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para gerenciar templates de prompt contextuais
 */
export class PromptTemplateService {
    private static instance: PromptTemplateService;
    private templates: PromptTemplate[] = [];

    private constructor() {
        this.initializeTemplates();
    }

    static getInstance(): PromptTemplateService {
        if (!PromptTemplateService.instance) {
            PromptTemplateService.instance = new PromptTemplateService();
        }
        return PromptTemplateService.instance;
    }

    /**
     * Inicializa os templates padrão
     */
    private initializeTemplates(): void {
        this.templates = [
            // Templates gerais
            {
                id: 'explain-code',
                title: '🔍 Explicar Código',
                description: 'Explica o que o código selecionado faz',
                prompt: 'Explique detalhadamente o que este código faz, como funciona e qual é seu propósito:',
                requiresSelection: true
            },
            {
                id: 'find-bugs',
                title: '🐛 Encontrar Bugs',
                description: 'Analisa o código em busca de possíveis bugs',
                prompt: 'Analise este código em busca de bugs, problemas de lógica, edge cases não tratados e possíveis melhorias:',
                requiresSelection: true
            },
            {
                id: 'optimize',
                title: '⚡ Otimizar Performance',
                description: 'Sugere otimizações de performance',
                prompt: 'Analise este código e sugira otimizações de performance, melhorias de algoritmo e boas práticas:',
                requiresSelection: true
            },
            {
                id: 'add-comments',
                title: '📝 Adicionar Comentários',
                description: 'Adiciona comentários explicativos ao código',
                prompt: 'Adicione comentários explicativos detalhados a este código, mantendo o código original:',
                requiresSelection: true
            },
            {
                id: 'write-tests',
                title: '🧪 Escrever Testes',
                description: 'Cria testes unitários para o código',
                prompt: 'Escreva testes unitários abrangentes para este código, incluindo casos de teste positivos, negativos e edge cases:',
                requiresSelection: true
            },
            {
                id: 'refactor',
                title: '🔄 Refatorar Código',
                description: 'Refatora o código para melhor legibilidade',
                prompt: 'Refatore este código para melhorar legibilidade, manutenibilidade e aderência às boas práticas:',
                requiresSelection: true
            },

            // Templates específicos para JavaScript/TypeScript
            {
                id: 'add-types',
                title: '🏷️ Adicionar Tipos TypeScript',
                description: 'Adiciona tipagem TypeScript ao código',
                prompt: 'Converta este código JavaScript para TypeScript, adicionando tipos apropriados e interfaces:',
                requiresSelection: true,
                supportedFileTypes: ['javascript', 'typescript']
            },
            {
                id: 'async-await',
                title: '⏳ Converter para Async/Await',
                description: 'Converte Promises para async/await',
                prompt: 'Converta este código que usa Promises para async/await, mantendo o tratamento de erros:',
                requiresSelection: true,
                supportedFileTypes: ['javascript', 'typescript']
            },

            // Templates para Python
            {
                id: 'add-docstrings',
                title: '📖 Adicionar Docstrings',
                description: 'Adiciona docstrings no formato Google/Sphinx',
                prompt: 'Adicione docstrings detalhadas no formato Google a este código Python:',
                requiresSelection: true,
                supportedFileTypes: ['python']
            },
            {
                id: 'type-hints',
                title: '🎯 Adicionar Type Hints',
                description: 'Adiciona type hints ao código Python',
                prompt: 'Adicione type hints apropriadas a este código Python, incluindo imports necessários:',
                requiresSelection: true,
                supportedFileTypes: ['python']
            },

            // Templates para análise de arquivo completo
            {
                id: 'code-review',
                title: '👀 Review Completo',
                description: 'Faz um review completo do arquivo',
                prompt: 'Faça um code review completo deste arquivo, analisando estrutura, padrões, possíveis melhorias e problemas:',
                requiresSelection: false
            },
            {
                id: 'security-audit',
                title: '🔒 Auditoria de Segurança',
                description: 'Analisa vulnerabilidades de segurança',
                prompt: 'Faça uma auditoria de segurança deste código, identificando vulnerabilidades e sugerindo correções:',
                requiresSelection: false
            },

            // Templates para Git/Commit
            {
                id: 'commit-message',
                title: '📝 Mensagem de Commit',
                description: 'Sugere mensagem de commit baseada nas mudanças',
                prompt: 'Baseado nas mudanças no código, sugira uma mensagem de commit clara e descritiva seguindo convenções:',
                requiresSelection: true
            }
        ];

        Logger.info(`Initialized ${this.templates.length} prompt templates`);
    }

    /**
     * Obtém templates compatíveis com o tipo de arquivo atual
     */
    getTemplatesForFileType(fileType?: string): PromptTemplate[] {
        if (!fileType) {
            return this.templates.filter(t => !t.supportedFileTypes);
        }

        return this.templates.filter(template => 
            !template.supportedFileTypes || 
            template.supportedFileTypes.includes(fileType)
        );
    }

    /**
     * Obtém templates que requerem seleção de código
     */
    getSelectionRequiredTemplates(fileType?: string): PromptTemplate[] {
        return this.getTemplatesForFileType(fileType).filter(t => t.requiresSelection);
    }

    /**
     * Obtém templates que funcionam sem seleção
     */
    getNoSelectionTemplates(fileType?: string): PromptTemplate[] {
        return this.getTemplatesForFileType(fileType).filter(t => !t.requiresSelection);
    }

    /**
     * Busca template por ID
     */
    getTemplateById(id: string): PromptTemplate | undefined {
        return this.templates.find(t => t.id === id);
    }

    /**
     * Obtém sugestões de templates baseadas no contexto
     */
    getSuggestedTemplates(fileType?: string, hasSelection: boolean = false): PromptTemplate[] {
        const availableTemplates = this.getTemplatesForFileType(fileType);
        
        if (hasSelection) {
            // Priorizar templates que usam seleção
            return [
                ...availableTemplates.filter(t => t.requiresSelection),
                ...availableTemplates.filter(t => !t.requiresSelection)
            ].slice(0, 6); // Limitar a 6 sugestões
        } else {
            // Mostrar apenas templates que não precisam de seleção
            return availableTemplates.filter(t => !t.requiresSelection).slice(0, 4);
        }
    }

    /**
     * Adiciona template customizado
     */
    addCustomTemplate(template: PromptTemplate): void {
        this.templates.push(template);
        Logger.info(`Added custom template: ${template.title}`);
    }

    /**
     * Remove template customizado
     */
    removeCustomTemplate(id: string): boolean {
        const index = this.templates.findIndex(t => t.id === id);
        if (index > -1) {
            this.templates.splice(index, 1);
            Logger.info(`Removed template: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Obtém estatísticas dos templates
     */
    getTemplateStats(): { 
        total: number; 
        byFileType: Record<string, number>; 
        requireSelection: number;
        general: number;
    } {
        const byFileType: Record<string, number> = {};
        let requireSelection = 0;
        let general = 0;

        this.templates.forEach(template => {
            if (template.requiresSelection) {
                requireSelection++;
            }

            if (!template.supportedFileTypes) {
                general++;
            } else {
                template.supportedFileTypes.forEach(type => {
                    byFileType[type] = (byFileType[type] || 0) + 1;
                });
            }
        });

        return {
            total: this.templates.length,
            byFileType,
            requireSelection,
            general
        };
    }
}
