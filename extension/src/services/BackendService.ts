import fetch from 'node-fetch';
import { BackendError, BackendResponse } from '../types';
import { Logger } from '../utils/Logger';
import { ConfigurationService } from './ConfigurationService';

/**
 * Serviço para comunicação com o backend
 */
export class BackendService {
    private static instance: BackendService;
    private configService: ConfigurationService;

    private constructor() {
        this.configService = ConfigurationService.getInstance();
    }

    static getInstance(): BackendService {
        if (!BackendService.instance) {
            BackendService.instance = new BackendService();
        }
        return BackendService.instance;
    }

    /**
     * Envia uma pergunta para o backend e retorna a resposta
     */
    async askQuestion(prompt: string): Promise<string> {
        const endpoint = this.configService.getBackendUrl();
        Logger.info(`Sending request to backend: ${endpoint}`);
        Logger.debug(`Prompt: ${prompt}`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            Logger.debug(`Response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                const error: BackendError = {
                    status: response.status,
                    message: errorText || response.statusText
                };
                Logger.error(`Backend error: ${error.status} - ${error.message}`);
                return `Erro HTTP ${error.status}: ${error.message}`;
            }

            const data = await response.json() as BackendResponse;
            Logger.debug('Backend response received successfully');

            return data.resposta || data.response || JSON.stringify(data);

        } catch (error: any) {
            Logger.error('Network error:', error);

            if (error.code === 'ECONNREFUSED') {
                return `Erro: Não foi possível conectar ao backend em ${endpoint}. Verifique se o servidor está rodando.`;
            }

            return `Falha na requisição: ${error.message}`;
        }
    }

    /**
     * Testa a conexão com o backend
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.askQuestion('test');
            return !response.startsWith('Erro');
        } catch {
            return false;
        }
    }

    /**
     * Solicita completion inline otimizada para código
     */
    async requestCodeCompletion(options: {
        prompt: string;
        context?: string;
        language: string;
        textBefore: string;
        textAfter: string;
    }): Promise<{ completion: string; duration: number; cached: boolean }> {
        const backendUrl = this.configService.getBackendUrl();
        const completionEndpoint = backendUrl.replace('/openai', '/api/completion');
        
        Logger.debug(`Requesting code completion from: ${completionEndpoint}`);

        try {
            const response = await fetch(completionEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(options)
            });

            if (!response.ok) {
                const errorText = await response.text();
                Logger.error(`Completion API error: ${response.status} - ${errorText}`);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            Logger.debug(`Completion received in ${data.duration}ms`);

            return {
                completion: data.completion || '',
                duration: data.duration || 0,
                cached: data.cached || false
            };

        } catch (error: any) {
            Logger.error('Completion request error:', error);
            throw error;
        }
    }

    /**
     * Envia pergunta com contexto completo (context-aware)
     */
    async askQuestionWithContext(options: {
        prompt: string;
        workspaceContext?: any;
        conversationHistory?: any[];
        gitInfo?: any;
        codeContext?: any;
    }): Promise<{
        response: string;
        duration: number;
        contextUsed: any;
    }> {
        const backendUrl = this.configService.getBackendUrl();
        const contextEndpoint = backendUrl.replace('/openai', '/api/context-aware');
        
        Logger.info(`Sending context-aware request to: ${contextEndpoint}`);
        Logger.debug('Context options:', JSON.stringify(options, null, 2));

        try {
            const response = await fetch(contextEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(options)
            });

            if (!response.ok) {
                const errorText = await response.text();
                Logger.error(`Context-aware API error: ${response.status} - ${errorText}`);
                
                // Fallback to regular API
                Logger.info('Falling back to regular API');
                const fallbackResponse = await this.askQuestion(options.prompt);
                return {
                    response: fallbackResponse,
                    duration: 0,
                    contextUsed: { fallback: true }
                };
            }

            const data = await response.json() as any;
            Logger.debug(`Context-aware response received in ${data.duration}ms`);

            return {
                response: data.response || '',
                duration: data.duration || 0,
                contextUsed: data.contextUsed || {}
            };

        } catch (error: any) {
            Logger.error('Context-aware request error:', error);
            
            // Fallback to regular API
            Logger.info('Falling back to regular API due to error');
            const fallbackResponse = await this.askQuestion(options.prompt);
            return {
                response: fallbackResponse,
                duration: 0,
                contextUsed: { fallback: true, error: error.message }
            };
        }
    }

    /**
     * Solicita análise de workspace
     */
    async analyzeWorkspace(workspaceData: {
        projectStructure: any;
        dependencies: any;
        codePatterns: any;
    }): Promise<string> {
        const backendUrl = this.configService.getBackendUrl();
        const analysisEndpoint = backendUrl.replace('/openai', '/api/analyze-workspace');
        
        Logger.info(`Requesting workspace analysis from: ${analysisEndpoint}`);

        try {
            const response = await fetch(analysisEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(workspaceData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                Logger.error(`Workspace analysis API error: ${response.status} - ${errorText}`);
                return `Erro na análise do workspace: ${errorText}`;
            }

            const data = await response.json() as any;
            Logger.debug('Workspace analysis received successfully');

            return data.insights || 'Análise não disponível';

        } catch (error: any) {
            Logger.error('Workspace analysis request error:', error);
            return `Erro ao analisar workspace: ${error.message}`;
        }
    }
}
