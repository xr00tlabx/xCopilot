import * as vscode from 'vscode';
import { ChatCommands } from './commands';
import { ConfigurationService, CodeContextService, PromptTemplateService } from './services';
import { Logger } from './utils';
import { ChatWebviewProvider } from './views';

/**
 * Classe principal da extensão xCopilot
 */
export class ExtensionManager {
    private chatProvider: ChatWebviewProvider;
    private chatCommands: ChatCommands;
    private configService: ConfigurationService;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        // Inicializar output channel
        this.outputChannel = vscode.window.createOutputChannel('xCopilot');
        Logger.init(this.outputChannel);

        // Inicializar serviços
        this.configService = ConfigurationService.getInstance();
        this.chatProvider = new ChatWebviewProvider();
        this.chatCommands = new ChatCommands(this.chatProvider);

        Logger.info('ExtensionManager initialized');
    }

    /**
     * Ativa a extensão
     */
    activate(context: vscode.ExtensionContext): void {
        Logger.info('🚀 xCopilot extension is now active!');

        try {
            // Registrar o provider da webview
            this.registerWebviewProvider(context);

            // Registrar comandos
            this.chatCommands.registerCommands(context);

            // Configurar monitoramento de configuração
            this.setupConfigurationWatcher(context);

            // Adicionar output channel aos subscriptions
            context.subscriptions.push(this.outputChannel);

            Logger.info('✅ Extension activation completed successfully');

        } catch (error) {
            Logger.error('❌ CRITICAL ERROR during extension activation:', error);
            vscode.window.showErrorMessage(`Erro crítico ao ativar xCopilot: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Registra o provider da webview
     */
    private registerWebviewProvider(context: vscode.ExtensionContext): void {
        Logger.info('📝 Registering WebviewViewProvider for xcopilotPanel...');

        const disposable = vscode.window.registerWebviewViewProvider(
            'xcopilotPanel',
            this.chatProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );

        context.subscriptions.push(disposable);
        Logger.info('✅ WebviewViewProvider registered successfully!');
    }

    /**
     * Configura o monitoramento de mudanças na configuração
     */
    private setupConfigurationWatcher(context: vscode.ExtensionContext): void {
        const configWatcher = this.configService.onConfigurationChanged(() => {
            vscode.window.showInformationMessage('URL do backend xCopilot atualizada.');
        });

        context.subscriptions.push(configWatcher);
        Logger.info('Configuration watcher setup completed');
    }

    /**
     * Desativa a extensão
     */
    deactivate(): void {
        Logger.info('🔄 xCopilot extension is being deactivated');
        this.outputChannel.dispose();
    }

    /**
     * Obtém a instância do provider do chat
     */
    getChatProvider(): ChatWebviewProvider {
        return this.chatProvider;
    }

    /**
     * Obtém o output channel
     */
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }
}
