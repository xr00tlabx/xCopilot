import * as vscode from 'vscode';
import { GitInfo } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para integração com Git
 */
export class GitIntegrationService {
    private static instance: GitIntegrationService;
    private gitExtension: any;
    private isInitialized = false;

    private constructor() {
        this.initializeGitExtension();
    }

    static getInstance(): GitIntegrationService {
        if (!GitIntegrationService.instance) {
            GitIntegrationService.instance = new GitIntegrationService();
        }
        return GitIntegrationService.instance;
    }

    /**
     * Inicializa a extensão do Git
     */
    private async initializeGitExtension(): Promise<void> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension) {
                if (!gitExtension.isActive) {
                    await gitExtension.activate();
                }
                this.gitExtension = gitExtension.exports?.getAPI?.(1);
                if (this.gitExtension) {
                    this.isInitialized = true;
                    Logger.info('Git extension initialized successfully');
                } else {
                    Logger.warn('Git API not available - Git features will be disabled');
                }
            } else {
                Logger.warn('Git extension not found - Git features will be disabled');
            }
        } catch (error) {
            Logger.warn('Git extension not available - Git features will be disabled');
            this.gitExtension = undefined;
        }
    }

    /**
     * Verifica se o Git está disponível
     */
    isGitAvailable(): boolean {
        try {
            return this.isInitialized && !!this.gitExtension && !!this.gitExtension.repositories;
        } catch (error) {
            Logger.warn('Error checking Git availability:', error);
            return false;
        }
    }

    /**
     * Obtém informações do Git para o workspace atual
     */
    async getGitInfo(): Promise<GitInfo | null> {
        if (!this.isGitAvailable()) {
            Logger.warn('Git not available for getGitInfo');
            return null;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders?.length) {
                Logger.warn('No workspace folders found');
                return null;
            }

            const repository = this.gitExtension.getRepository(workspaceFolders[0].uri);
            if (!repository) {
                Logger.warn('No Git repository found in workspace');
                return null;
            }

            const gitInfo: GitInfo = {
                currentBranch: repository.state.HEAD?.name || 'unknown',
                hasUncommittedChanges: repository.state.workingTreeChanges.length > 0 || repository.state.indexChanges.length > 0,
                lastCommitMessage: repository.state.HEAD?.commit?.message || '',
                changedFiles: [
                    ...repository.state.workingTreeChanges.map((c: any) => c.uri.fsPath),
                    ...repository.state.indexChanges.map((c: any) => c.uri.fsPath)
                ],
                diff: await this.getRepositoryDiff(repository)
            };

            Logger.debug('Git info retrieved successfully');
            return gitInfo;

        } catch (error) {
            Logger.error('Error getting Git info:', error);
            return null;
        }
    }

    /**
     * Obtém diff do repositório
     */
    private async getRepositoryDiff(repository: any): Promise<string | undefined> {
        try {
            // Simplificado - retorna uma mensagem indicativa
            const changes = repository.state.workingTreeChanges.length + repository.state.indexChanges.length;
            return changes > 0 ? `${changes} files changed` : undefined;
        } catch (error) {
            Logger.warn('Error getting repository diff:', error);
            return undefined;
        }
    }

    /**
     * Obtém diff do arquivo atual
     */
    async getCurrentFileDiff(): Promise<string | null> {
        if (!this.isGitAvailable()) {
            Logger.warn('Git not available for getCurrentFileDiff');
            return null;
        }

        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                Logger.warn('No active editor for diff analysis');
                return null;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders?.length) {
                return null;
            }

            const repository = this.gitExtension.getRepository(workspaceFolders[0].uri);
            if (!repository) {
                return null;
            }

            // Versão simplificada - retorna o nome do arquivo modificado
            const fileName = editor.document.fileName;
            const isModified = editor.document.isDirty || repository.state.workingTreeChanges.some((c: any) =>
                c.uri.fsPath === fileName
            );

            return isModified ? `File modified: ${fileName}` : null;

        } catch (error) {
            Logger.error('Error getting file diff:', error);
            return null;
        }
    }

    /**
     * Gera sugestão de mensagem de commit baseada nas mudanças
     */
    async generateCommitMessage(changedFiles: string[], diff?: string): Promise<string> {
        const fileTypes = this.analyzeFileTypes(changedFiles);
        const changeScope = this.analyzeChangeScope(changedFiles);

        // Determinar tipo de commit
        let type = 'feat';
        if (changedFiles.some(f => f.includes('test') || f.includes('spec'))) {
            type = 'test';
        } else if (changedFiles.some(f => f.includes('doc') || f.includes('README'))) {
            type = 'docs';
        } else if (changedFiles.some(f => f.includes('fix') || f.includes('bug'))) {
            type = 'fix';
        } else if (changedFiles.some(f => f.includes('style') || f.includes('css'))) {
            type = 'style';
        }

        // Gerar mensagem
        const scope = changeScope.length > 0 ? `(${changeScope.join(', ')})` : '';
        const fileTypesList = fileTypes.length > 0 ? ` - ${fileTypes.join(', ')}` : '';

        return `${type}${scope}: update ${changedFiles.length} file(s)${fileTypesList}`;
    }

    /**
     * Analisa tipos de arquivos modificados
     */
    private analyzeFileTypes(files: string[]): string[] {
        const types = new Set<string>();

        files.forEach(file => {
            const ext = file.split('.').pop()?.toLowerCase();
            if (ext) {
                types.add(ext);
            }
        });

        return Array.from(types).slice(0, 3); // Limitar a 3 tipos
    }

    /**
     * Analisa escopo das mudanças
     */
    private analyzeChangeScope(files: string[]): string[] {
        const scopes = new Set<string>();

        files.forEach(file => {
            const parts = file.split('/');
            if (parts.length > 1) {
                scopes.add(parts[parts.length - 2]); // Pasta pai
            }
        });

        return Array.from(scopes).slice(0, 2); // Limitar a 2 escopos
    }
}
