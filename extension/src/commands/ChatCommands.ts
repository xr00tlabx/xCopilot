import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ChatWebviewProvider } from '../views/ChatWebviewProvider';

/**
 * Gerenciador de comandos da extensão xCopilot
 */
export class ChatCommands {
    private chatProvider: ChatWebviewProvider;

    constructor(chatProvider: ChatWebviewProvider) {
        this.chatProvider = chatProvider;
    }

    /**
     * Registra todos os comandos da extensão
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Comando para fazer pergunta via input box
        const askCommand = vscode.commands.registerCommand('xcopilot.ask', async () => {
            await this.handleAskCommand();
        });

        // Comando de teste
        const testCommand = vscode.commands.registerCommand('xcopilot.test', () => {
            this.handleTestCommand();
        });

        // Comando para abrir o chat
        const openChatCommand = vscode.commands.registerCommand('xcopilot.openChat', async () => {
            await this.handleOpenChatCommand();
        });

        // Adicionar aos subscriptions
        context.subscriptions.push(askCommand, testCommand, openChatCommand);
        Logger.info('All commands registered successfully');
    }

    /**
     * Lida com o comando xcopilot.ask
     */
    private async handleAskCommand(): Promise<void> {
        try {
            // Abrir a view primeiro
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');

            // Pedir input do usuário
            const prompt = await vscode.window.showInputBox({
                placeHolder: 'Pergunte ao xCopilot',
                prompt: 'Digite sua pergunta para o xCopilot'
            });

            if (!prompt) {
                return;
            }

            // Verificar se a webview está ativa
            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada. Tente novamente em alguns segundos.');
                return;
            }

            // Enviar pergunta
            await this.chatProvider.askQuestion(prompt);
            Logger.info(`Question sent via command: ${prompt}`);

        } catch (error) {
            Logger.error('Error in ask command:', error);
            vscode.window.showErrorMessage(`Erro ao executar comando: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Lida com o comando de teste
     */
    private handleTestCommand(): void {
        vscode.window.showInformationMessage('xCopilot está funcionando!');
        Logger.info('Test command executed');
    }

    /**
     * Lida com o comando para abrir o chat
     */
    private async handleOpenChatCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            Logger.info('Chat opened via command');
        } catch (error) {
            Logger.error('Error opening chat:', error);
            vscode.window.showErrorMessage('Erro ao abrir o chat do xCopilot');
        }
    }
}
