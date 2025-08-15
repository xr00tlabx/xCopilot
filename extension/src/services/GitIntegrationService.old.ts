import * as vscode from 'vscode';
import { GitInfo } from '../types';
import { Logger } from '../utils/Logger';

/**
 * Serviço para integração com Git
 */
export class GitIntegrationService {
    private static instance: GitIntegrationService;
    private gitExtension: any;

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
                    Logger.info('Git extension initialized successfully');
                } else {
                    Logger.warn('Git API not available - Git features will be disabled');
                }
            } else {
                Logger.warn('Git extension not found - Git features will be disabled');
            }
        } catch (error) {
            Logger.warn('Git extension not available - Git features will be disabled:', error);
            this.gitExtension = undefined;
        }
    }

    /**
     * Verifica se o Git está disponível
     */
    isGitAvailable(): boolean {
        try {
            return !!this.gitExtension && !!this.gitExtension.repositories && this.gitExtension.repositories.length > 0;
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
                changedFiles: [
                    ...repository.state.workingTreeChanges.map((change: any) => change.uri.fsPath),
                    ...repository.state.indexChanges.map((change: any) => change.uri.fsPath)
                ]
            };

            // Obter última mensagem de commit
            if (repository.state.HEAD?.commit) {
                try {
                    const commit = await repository.getCommit(repository.state.HEAD.commit);
                    gitInfo.lastCommitMessage = commit.message;
                } catch (error) {
                    Logger.warn('Could not get last commit message:', error);
                }
            }

            Logger.debug('Git info retrieved successfully');
            return gitInfo;

        } catch (error) {
            Logger.error('Error getting Git info:', error);
            return null;
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
            }

            const repository = this.gitExtension.getRepository(workspaceFolders[0].uri);
            if (!repository) {
                return null;
            }

            const fileUri = editor.document.uri;
            const diff = await repository.diffWithHEAD(fileUri);
            
            return diff || null;

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
        
        // Lógica simples para gerar mensagem de commit
        let type = 'feat';
        if (changedFiles.some(f => f.includes('test') || f.includes('spec'))) {
            type = 'test';
        } else if (changedFiles.some(f => f.includes('doc') || f.includes('README'))) {
            type = 'docs';
        } else if (changedFiles.some(f => f.includes('config') || f.includes('package.json'))) {
            type = 'chore';
        } else if (this.hasOnlyStyleChanges(diff)) {
            type = 'style';
        }

        const scope = changeScope ? `(${changeScope})` : '';
        const description = this.generateDescription(changedFiles, fileTypes);

        return `${type}${scope}: ${description}`;
    }

    /**
     * Analisa os tipos de arquivos modificados
     */
    private analyzeFileTypes(files: string[]): string[] {
        const extensions = files
            .map(file => file.split('.').pop()?.toLowerCase())
            .filter(ext => ext)
            .filter((ext, index, arr) => arr.indexOf(ext) === index) as string[];
        
        return extensions;
    }

    /**
     * Analisa o escopo das mudanças
     */
    private analyzeChangeScope(files: string[]): string | null {
        const dirs = files
            .map(file => file.split('/')[0])
            .filter((dir, index, arr) => arr.indexOf(dir) === index);
        
        if (dirs.length === 1) {
            return dirs[0];
        }
        
        // Se muitos diretórios, tentar identificar padrões
        if (dirs.some(dir => dir.includes('frontend') || dir.includes('client'))) {
            return 'frontend';
        }
        if (dirs.some(dir => dir.includes('backend') || dir.includes('server'))) {
            return 'backend';
        }
        if (dirs.some(dir => dir.includes('extension'))) {
            return 'extension';
        }
        
        return null;
    }

    /**
     * Verifica se são apenas mudanças de estilo
     */
    private hasOnlyStyleChanges(diff?: string): boolean {
        if (!diff) return false;
        
        // Lógica simples: se o diff contém principalmente mudanças de espaçamento/formatação
        const lines = diff.split('\n');
        const significantChanges = lines.filter(line => 
            line.startsWith('+') || line.startsWith('-')
        ).filter(line => 
            !/^\s*[\+\-]\s*$/.test(line) // Não é apenas espaço em branco
        );
        
        return significantChanges.length === 0;
    }

    /**
     * Gera descrição baseada nos arquivos modificados
     */
    private generateDescription(files: string[], fileTypes: string[]): string {
        if (files.length === 1) {
            const fileName = files[0].split('/').pop() || files[0];
            return `Update ${fileName}`;
        }
        
        if (fileTypes.length === 1) {
            return `Update ${fileTypes[0]} files`;
        }
        
        const mainTypes = fileTypes.slice(0, 2).join(' and ');
        return `Update ${mainTypes} files`;
    }

    /**
     * Sugere melhorias para mensagem de commit existente
     */
    suggestCommitImprovements(message: string): string[] {
        const suggestions: string[] = [];
        
        // Verificar formato conventional commits
        if (!/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/.test(message)) {
            suggestions.push('Consider using conventional commit format: type(scope): description');
        }
        
        // Verificar tamanho
        if (message.length > 72) {
            suggestions.push('Keep commit message under 72 characters for better readability');
        }
        
        if (message.length < 10) {
            suggestions.push('Add more descriptive information about the changes');
        }
        
        // Verificar se começa com maiúscula
        const description = message.split(': ')[1] || message;
        if (description && description[0] !== description[0].toUpperCase()) {
            suggestions.push('Start description with a capital letter');
        }
        
        // Verificar se termina com ponto
        if (message.endsWith('.')) {
            suggestions.push('Remove trailing period from commit message');
        }
        
        return suggestions;
    }

    /**
     * Obtém lista de branches
     */
    async getBranches(): Promise<string[]> {
        if (!this.isGitAvailable()) {
            return [];
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders?.length) {
                return [];
            }

            const repository = this.gitExtension.getRepository(workspaceFolders[0].uri);
            if (!repository) {
                return [];
            }

            return repository.state.refs
                .filter((ref: any) => ref.type === 0) // Local branches
                .map((ref: any) => ref.name || '');

        } catch (error) {
            Logger.error('Error getting branches:', error);
            return [];
        }
    }
}
