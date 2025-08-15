import * as vscode from 'vscode';
import { CodeContextService, PromptTemplateService } from '../services';
import { Logger } from '../utils';
import { ChatWebviewProvider } from '../views';

/**
 * Gerenciador de comandos da extensão xCopilot
 */
export class ChatCommands {
    private chatProvider: ChatWebviewProvider;
    private contextService: CodeContextService;
    private templateService: PromptTemplateService;

    constructor(chatProvider: ChatWebviewProvider) {
        this.chatProvider = chatProvider;
        this.contextService = CodeContextService.getInstance();
        this.templateService = PromptTemplateService.getInstance();
    }

    /**
     * Registra todos os comandos da extensão
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Comando para fazer pergunta via input box
        const askCommand = vscode.commands.registerCommand('xcopilot.ask', async () => {
            await this.handleAskCommand();
        });

        // Comando para explicar código selecionado
        const explainCommand = vscode.commands.registerCommand('xcopilot.explainCode', async () => {
            await this.handleExplainCodeCommand();
        });

        // Comando para usar templates
        const templateCommand = vscode.commands.registerCommand('xcopilot.useTemplate', async () => {
            await this.handleTemplateCommand();
        });

        // Comando para análise de arquivo completo
        const analyzeFileCommand = vscode.commands.registerCommand('xcopilot.analyzeFile', async () => {
            await this.handleAnalyzeFileCommand();
        });

        // Comando para encontrar bugs
        const findBugsCommand = vscode.commands.registerCommand('xcopilot.findBugs', async () => {
            await this.handleFindBugsCommand();
        });

        // Comando de teste
        const testCommand = vscode.commands.registerCommand('xcopilot.test', () => {
            this.handleTestCommand();
        });

        // Comando para abrir o chat
        const openChatCommand = vscode.commands.registerCommand('xcopilot.openChat', async () => {
            await this.handleOpenChatCommand();
        });

        // Comando para pesquisar histórico
        const searchHistoryCommand = vscode.commands.registerCommand('xcopilot.searchHistory', async () => {
            await this.handleSearchHistoryCommand();
        });

        // Comando para exportar histórico
        const exportHistoryCommand = vscode.commands.registerCommand('xcopilot.exportHistory', async () => {
            await this.handleExportHistoryCommand();
        });

        // Comando para limpar histórico
        const clearHistoryCommand = vscode.commands.registerCommand('xcopilot.clearHistory', async () => {
            await this.handleClearHistoryCommand();
        });

        // Comando para gerar commit message
        const generateCommitCommand = vscode.commands.registerCommand('xcopilot.generateCommit', async () => {
            await this.handleGenerateCommitCommand();
        });

        // Comando para analisar diff
        const analyzeDiffCommand = vscode.commands.registerCommand('xcopilot.analyzeDiff', async () => {
            await this.handleAnalyzeDiffCommand();
        });

        // Adicionar aos subscriptions
        context.subscriptions.push(
            askCommand, 
            explainCommand, 
            templateCommand, 
            analyzeFileCommand,
            findBugsCommand,
            testCommand, 
            openChatCommand,
            searchHistoryCommand,
            exportHistoryCommand,
            clearHistoryCommand,
            generateCommitCommand,
            analyzeDiffCommand
        );
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

    /**
     * Lida com o comando para explicar código selecionado
     */
    private async handleExplainCodeCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.contextService.hasUsefulContext()) {
                vscode.window.showWarningMessage('Nenhum arquivo aberto para análise.');
                return;
            }

            const context = this.contextService.getCurrentContext();
            if (!context?.selectedText) {
                vscode.window.showWarningMessage('Selecione o código que deseja explicar.');
                return;
            }

            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            const template = this.templateService.getTemplateById('explain-code');
            if (template) {
                await this.chatProvider.askQuestionWithContext(template.prompt);
                Logger.info('Explain code command executed');
            }
        } catch (error) {
            Logger.error('Error in explain code command:', error);
            vscode.window.showErrorMessage('Erro ao explicar código');
        }
    }

    /**
     * Lida com o comando de templates
     */
    private async handleTemplateCommand(): Promise<void> {
        try {
            const stats = this.contextService.getContextStats();
            const templates = this.templateService.getSuggestedTemplates(
                stats?.fileType, 
                stats?.hasSelection
            );

            if (templates.length === 0) {
                vscode.window.showInformationMessage('Nenhum template disponível para o contexto atual.');
                return;
            }

            const items = templates.map(template => ({
                label: template.title,
                description: template.description,
                detail: template.requiresSelection ? '(Requer seleção de código)' : '(Análise geral)',
                template
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Escolha um template para usar',
                matchOnDescription: true
            });

            if (!selected) {
                return;
            }

            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');

            if (selected.template.requiresSelection) {
                const context = this.contextService.getCurrentContext();
                if (!context?.selectedText) {
                    vscode.window.showWarningMessage('Este template requer que você selecione código primeiro.');
                    return;
                }
            }

            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            await this.chatProvider.askQuestionWithContext(selected.template.prompt);
            Logger.info(`Template command executed: ${selected.template.id}`);

        } catch (error) {
            Logger.error('Error in template command:', error);
            vscode.window.showErrorMessage('Erro ao usar template');
        }
    }

    /**
     * Lida com o comando de análise de arquivo completo
     */
    private async handleAnalyzeFileCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.contextService.hasUsefulContext()) {
                vscode.window.showWarningMessage('Nenhum arquivo aberto para análise.');
                return;
            }

            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            const template = this.templateService.getTemplateById('code-review');
            if (template) {
                await this.chatProvider.askQuestionWithContext(template.prompt, true);
                Logger.info('Analyze file command executed');
            }
        } catch (error) {
            Logger.error('Error in analyze file command:', error);
            vscode.window.showErrorMessage('Erro ao analisar arquivo');
        }
    }

    /**
     * Lida com o comando para encontrar bugs
     */
    private async handleFindBugsCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.contextService.hasUsefulContext()) {
                vscode.window.showWarningMessage('Nenhum arquivo aberto para análise.');
                return;
            }

            const context = this.contextService.getCurrentContext();
            if (!context?.selectedText) {
                vscode.window.showWarningMessage('Selecione o código que deseja analisar para bugs.');
                return;
            }

            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            const template = this.templateService.getTemplateById('find-bugs');
            if (template) {
                await this.chatProvider.askQuestionWithContext(template.prompt);
                Logger.info('Find bugs command executed');
            }
        } catch (error) {
            Logger.error('Error in find bugs command:', error);
            vscode.window.showErrorMessage('Erro ao procurar bugs');
        }
    }

    /**
     * Pesquisar no histórico de conversas
     */
    private async handleSearchHistoryCommand(): Promise<void> {
        try {
            const searchTerm = await vscode.window.showInputBox({
                prompt: 'Digite o termo para pesquisar no histórico',
                placeHolder: 'Ex: função, error, typescript...'
            });

            if (!searchTerm) {
                return;
            }

            // Abrir a view primeiro
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            await this.chatProvider.searchHistory(searchTerm);
            Logger.info(`History search executed for: ${searchTerm}`);
        } catch (error) {
            Logger.error('Error in search history command:', error);
            vscode.window.showErrorMessage('Erro ao pesquisar histórico');
        }
    }

    /**
     * Exportar histórico para arquivo
     */
    private async handleExportHistoryCommand(): Promise<void> {
        try {
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'Markdown': ['md'],
                    'Todos os arquivos': ['*']
                },
                defaultUri: vscode.Uri.file('xcopilot-history.md')
            });

            if (!uri) {
                return;
            }

            await this.chatProvider.exportHistory(uri.fsPath);
            vscode.window.showInformationMessage(`Histórico exportado para: ${uri.fsPath}`);
            Logger.info(`History exported to: ${uri.fsPath}`);
        } catch (error) {
            Logger.error('Error in export history command:', error);
            vscode.window.showErrorMessage('Erro ao exportar histórico');
        }
    }

    /**
     * Limpar histórico de conversas
     */
    private async handleClearHistoryCommand(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'Tem certeza que deseja limpar todo o histórico de conversas?',
                { modal: true },
                'Sim, limpar'
            );

            if (confirmation === 'Sim, limpar') {
                await this.chatProvider.clearHistory();
                vscode.window.showInformationMessage('Histórico limpo com sucesso');
                Logger.info('History cleared');
            }
        } catch (error) {
            Logger.error('Error in clear history command:', error);
            vscode.window.showErrorMessage('Erro ao limpar histórico');
        }
    }

    /**
     * Gerar mensagem de commit baseada nas mudanças
     */
    private async handleGenerateCommitCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            await this.chatProvider.generateCommitMessage();
            Logger.info('Generate commit command executed');
        } catch (error) {
            Logger.error('Error in generate commit command:', error);
            vscode.window.showErrorMessage('Erro ao gerar mensagem de commit');
        }
    }

    /**
     * Analisar diferenças do arquivo atual
     */
    private async handleAnalyzeDiffCommand(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
            
            if (!this.chatProvider.isActive()) {
                vscode.window.showWarningMessage('View xCopilot ainda não inicializada.');
                return;
            }

            await this.chatProvider.analyzeDiff();
            Logger.info('Analyze diff command executed');
        } catch (error) {
            Logger.error('Error in analyze diff command:', error);
            vscode.window.showErrorMessage('Erro ao analisar diferenças');
        }
    }
}
