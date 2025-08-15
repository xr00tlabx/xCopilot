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
     * Inicializa a extensão do Git (sem throw de erro)
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
            return this.isInitialized && !!this.gitExtension;
        } catch (error) {
            return false;
        }
    }

    /**
     * Obtém informações do Git para o workspace atual
     */
    async getGitInfo(): Promise<GitInfo | null> {
        if (!this.isGitAvailable()) {
            return null;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders?.length) {
                return null;
            }

            const repository = this.gitExtension.getRepository(workspaceFolders[0].uri);
            if (!repository) {
                return null;
            }

            const gitInfo: GitInfo = {
                currentBranch: repository.state.HEAD?.name || 'unknown',
                hasUncommittedChanges: 
                    (repository.state.workingTreeChanges?.length || 0) > 0 || 
                    (repository.state.indexChanges?.length || 0) > 0,
                lastCommitMessage: repository.state.HEAD?.commit?.message || '',
                changedFiles: [
                    ...(repository.state.workingTreeChanges?.map((c: any) => c.uri.fsPath) || []),
                    ...(repository.state.indexChanges?.map((c: any) => c.uri.fsPath) || [])
                ],
                diff: undefined // Simplificado por enquanto
            };

            return gitInfo;

        } catch (error) {
            Logger.error('Error getting Git info:', error);
            return null;
        }
    }

    /**
     * Obtém diff do arquivo atual (versão simplificada)
     */
    async getCurrentFileDiff(): Promise<string | null> {
        if (!this.isGitAvailable()) {
            return null;
        }

        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return null;
            }

            // Versão simplificada - apenas verifica se o arquivo foi modificado
            const fileName = editor.document.fileName;
            const isModified = editor.document.isDirty;

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
        try {
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
        } catch (error) {
            Logger.error('Error generating commit message:', error);
            return 'feat: update files';
        }
    }

    /**
     * Analisa tipos de arquivos modificados
     */
    private analyzeFileTypes(files: string[]): string[] {
        try {
            const types = new Set<string>();
            
            files.forEach(file => {
                const ext = file.split('.').pop()?.toLowerCase();
                if (ext) {
                    types.add(ext);
                }
            });
            
            return Array.from(types).slice(0, 3); // Limitar a 3 tipos
        } catch (error) {
            return [];
        }
    }

    /**
     * Analisa escopo das mudanças
     */
    private analyzeChangeScope(files: string[]): string[] {
        try {
            const scopes = new Set<string>();
            
            files.forEach(file => {
                const parts = file.split('/');
                if (parts.length > 1) {
                    scopes.add(parts[parts.length - 2]); // Pasta pai
                }
            });
            
            return Array.from(scopes).slice(0, 2); // Limitar a 2 escopos
        } catch (error) {
            return [];
        }
    }
}
