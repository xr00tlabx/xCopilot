/**
 * Comandos para geração de código multi-linha
 */

import * as vscode from 'vscode';
import { MultilineCodeGenerationService } from '../services/MultilineCodeGenerationService';

export class CodeGenerationCommands {
    private multilineService: MultilineCodeGenerationService;

    constructor() {
        this.multilineService = MultilineCodeGenerationService.getInstance();
    }

    /**
     * Registra todos os comandos de geração de código
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Comando para gerar código a partir de comentários
        const generateFromComments = vscode.commands.registerCommand(
            'xcopilot.generateFromComments',
            () => this.multilineService.detectAndGenerateFromComments()
        );

        // Comando para implementar interfaces vazias
        const implementInterfaces = vscode.commands.registerCommand(
            'xcopilot.implementInterfaces',
            () => this.multilineService.implementEmptyInterfaces()
        );

        // Comando para gerar função completa
        const generateFunction = vscode.commands.registerCommand(
            'xcopilot.generateFunction',
            () => this.multilineService.generateCompleteFunction()
        );

        // Comando para gerar código de padrão
        const generatePattern = vscode.commands.registerCommand(
            'xcopilot.generatePattern',
            () => this.multilineService.generateFromPattern()
        );

        // Note: `xcopilot.analyzePatterns` is registered by PatternDetectionService to avoid duplicate registrations.

        // Comando para escanear comentários TODO/FIXME
        const scanTodoComments = vscode.commands.registerCommand(
            'xcopilot.scanTodoComments',
            () => this.multilineService.scanWorkspaceForComments()
        );

        // Adiciona os comandos ao contexto
        // Push the other static command disposables. `analyzePatterns` is pushed conditionally above.
        context.subscriptions.push(
            generateFromComments,
            implementInterfaces,
            generateFunction,
            generatePattern,
            scanTodoComments
        );

        console.log('xCopilot Multi-line Code Generation commands registered');
    }
}