import * as vscode from 'vscode';
import { InlineCompletionService } from '../services/InlineCompletionService';
import { Logger } from '../utils/Logger';

/**
 * Comandos para gerenciamento do Inline Completion
 */
export class InlineCompletionCommands {
    private inlineCompletionService: InlineCompletionService;

    constructor() {
        this.inlineCompletionService = InlineCompletionService.getInstance();
    }

    /**
     * Registra todos os comandos relacionados ao inline completion
     */
    registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            vscode.commands.registerCommand('xcopilot.toggleInlineCompletion', () => this.toggleInlineCompletion()),
            vscode.commands.registerCommand('xcopilot.clearCompletionCache', () => this.clearCompletionCache()),
            vscode.commands.registerCommand('xcopilot.showCompletionStats', () => this.showCompletionStats())
        ];

        context.subscriptions.push(...commands);
        Logger.info('Inline completion commands registered');
    }

    /**
     * Toggle enable/disable do inline completion
     */
    private async toggleInlineCompletion(): Promise<void> {
        try {
            const currentState = this.inlineCompletionService.isServiceEnabled();
            const newState = !currentState;
            
            this.inlineCompletionService.setEnabled(newState);
            
            const message = `Inline Completion ${newState ? 'habilitado' : 'desabilitado'}`;
            vscode.window.showInformationMessage(message);
            
            Logger.info(`Inline completion toggled: ${newState}`);
        } catch (error) {
            Logger.error('Error toggling inline completion:', error);
            vscode.window.showErrorMessage('Erro ao alternar inline completion');
        }
    }

    /**
     * Limpa o cache de completions
     */
    private async clearCompletionCache(): Promise<void> {
        try {
            const stats = this.inlineCompletionService.getStats();
            this.inlineCompletionService.clearCache();
            
            const message = `Cache limpo! (${stats.requestCount} requisições, ${stats.cacheHits} hits)`;
            vscode.window.showInformationMessage(message);
            
            Logger.info('Completion cache cleared by user');
        } catch (error) {
            Logger.error('Error clearing completion cache:', error);
            vscode.window.showErrorMessage('Erro ao limpar cache de completions');
        }
    }

    /**
     * Mostra estatísticas do inline completion
     */
    private async showCompletionStats(): Promise<void> {
        try {
            const stats = this.inlineCompletionService.getStats();
            const enabled = this.inlineCompletionService.isServiceEnabled();
            
            const message = `📊 Estatísticas do Inline Completion:

Status: ${enabled ? '✅ Habilitado' : '❌ Desabilitado'}
Requisições: ${stats.requestCount}
Cache Hits: ${stats.cacheHits}
Taxa de Cache: ${stats.cacheHitRate.toFixed(1)}%

Cache:
- Tamanho: ${stats.cacheStats.size}/${stats.cacheStats.capacity}
- Utilização: ${stats.cacheStats.utilization.toFixed(1)}%`;

            vscode.window.showInformationMessage(message, { modal: true });
            
            Logger.info('Completion stats displayed to user');
        } catch (error) {
            Logger.error('Error showing completion stats:', error);
            vscode.window.showErrorMessage('Erro ao mostrar estatísticas de completion');
        }
    }
}