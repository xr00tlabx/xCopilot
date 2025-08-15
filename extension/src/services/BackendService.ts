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
}
