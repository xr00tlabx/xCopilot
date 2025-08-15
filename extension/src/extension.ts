import * as vscode from 'vscode';
import { ExtensionManager } from './ExtensionManager';

// Instância global do gerenciador da extensão
let extensionManager: ExtensionManager;

/**
 * Função chamada quando a extensão é ativada
 */
export function activate(context: vscode.ExtensionContext) {
    extensionManager = new ExtensionManager();
    extensionManager.activate(context);
}

/**
 * Função chamada quando a extensão é desativada
 */
export function deactivate() {
    if (extensionManager) {
        extensionManager.deactivate();
    }
}
