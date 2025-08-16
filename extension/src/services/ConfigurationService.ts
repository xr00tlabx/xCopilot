import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para gerenciar configurações da extensão
 */
export class ConfigurationService {
    private static instance: ConfigurationService;

    private constructor() { }

    static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    /**
     * Obtém a configuração atual da extensão
     */
    getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration('xcopilot');
        return {
            backendUrl: config.get<string>('backendUrl') || 'http://localhost:3000',
            inlineCompletion: {
                enabled: config.get<boolean>('inlineCompletion.enabled') ?? true,
                throttleMs: config.get<number>('inlineCompletion.throttleMs') || 300,
                cacheSize: config.get<number>('inlineCompletion.cacheSize') || 100,
                maxContextLines: config.get<number>('inlineCompletion.maxContextLines') || 15
            }
        };
    }

    /**
     * Obtém a URL do endpoint OpenAI do backend
     */
    getBackendUrl(): string {
        const config = this.getConfig();
        let base = config.backendUrl.trim();

        if (base.endsWith('/')) {
            base = base.slice(0, -1);
        }

        if (!/\/openai$/.test(base)) {
            base += '/openai';
        }

        Logger.debug(`Backend URL configured: ${base}`);
        return base;
    }

    /**
     * Monitora mudanças na configuração
     */
    onConfigurationChanged(callback: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('xcopilot.backendUrl') || 
                e.affectsConfiguration('xcopilot.inlineCompletion')) {
                Logger.info('Configuration changed');
                callback();
            }
        });
    }
}
