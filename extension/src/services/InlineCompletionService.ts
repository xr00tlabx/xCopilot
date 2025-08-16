import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { LRUCache } from '../utils/LRUCache';
import { BackendService } from './BackendService';
import { CodeContextService } from './CodeContextService';
import { ConfigurationService } from './ConfigurationService';

interface CompletionCacheKey {
    textBefore: string;
    textAfter: string;
    language: string;
    context: string;
}

interface CompletionCacheValue {
    completion: string;
    timestamp: number;
}

/**
 * Serviço para completions inline em tempo real (similar ao GitHub Copilot)
 */
export class InlineCompletionService implements vscode.InlineCompletionItemProvider {
    private static instance: InlineCompletionService;
    private backendService: BackendService;
    private contextService: CodeContextService;
    private configService: ConfigurationService;
    private isEnabled = true;
    private disposables: vscode.Disposable[] = [];
    private lastRequestTime = 0;
    private throttleMs = 300; // Will be updated from config
    private cache: LRUCache<string, CompletionCacheValue> = new LRUCache<string, CompletionCacheValue>(100);
    private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
    private requestCount = 0;
    private cacheHits = 0;

    private constructor() {
        this.backendService = BackendService.getInstance();
        this.contextService = CodeContextService.getInstance();
        this.configService = ConfigurationService.getInstance();
        
        // Initialize with config values
        this.updateFromConfig();
        
        this.registerProviders();
        this.setupConfigurationWatcher();
    }

    static getInstance(): InlineCompletionService {
        if (!InlineCompletionService.instance) {
            InlineCompletionService.instance = new InlineCompletionService();
        }
        return InlineCompletionService.instance;
    }

    /**
     * Registra os providers de completion inline
     */
    private registerProviders(): void {
        // Registrar para várias linguagens
        const selector = [
            'typescript', 'javascript', 'python', 'java', 'csharp',
            'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
        ];

        const provider = vscode.languages.registerInlineCompletionItemProvider(
            selector,
            this
        );

        this.disposables.push(provider);
        Logger.info('Inline completion provider registered');
    }

    /**
     * Update settings from configuration
     */
    updateFromConfig(): void {
        const config = this.configService.getConfig();
        this.isEnabled = config.inlineCompletion.enabled;
        this.throttleMs = config.inlineCompletion.throttleMs;
        
        // Recreate cache with new size if needed
        const newCacheSize = config.inlineCompletion.cacheSize;
        if (!this.cache || this.cache.stats().capacity !== newCacheSize) {
            this.cache = new LRUCache<string, CompletionCacheValue>(newCacheSize);
        }
        
        Logger.info(`Inline completion config updated: enabled=${this.isEnabled}, throttle=${this.throttleMs}ms, cache=${newCacheSize}`);
    }

    /**
     * Setup configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        const configDisposable = this.configService.onConfigurationChanged(() => {
            this.updateFromConfig();
        });
        this.disposables.push(configDisposable);
    }

    /**
     * Implementação do VS Code InlineCompletionItemProvider
     */
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        try {
            if (!this.isEnabled || token.isCancellationRequested) {
                return null;
            }

            // Throttle requests para evitar spam
            const now = Date.now();
            if (now - this.lastRequestTime < this.throttleMs) {
                return null;
            }
            this.lastRequestTime = now;

            const line = document.lineAt(position);
            const textBeforeCursor = line.text.substring(0, position.character);
            const textAfterCursor = line.text.substring(position.character);

            // Só sugerir se há contexto suficiente
            if (textBeforeCursor.trim().length < 2) {
                return null;
            }

            // Verificar se não está no meio de uma string ou comentário
            if (this.isInStringOrComment(textBeforeCursor)) {
                return null;
            }

            // Check cache first
            const cacheKey = this.generateCacheKey(textBeforeCursor, textAfterCursor, document.languageId);
            const cachedCompletion = this.getCachedCompletion(cacheKey);
            
            if (cachedCompletion) {
                this.cacheHits++;
                Logger.debug(`Cache hit! (${this.cacheHits}/${this.requestCount})`);
                return [
                    new vscode.InlineCompletionItem(
                        cachedCompletion,
                        new vscode.Range(position, position)
                    )
                ];
            }

            this.requestCount++;

            const completion = await this.generateInlineCompletion(
                document,
                position,
                textBeforeCursor,
                textAfterCursor
            );

            if (!completion || token.isCancellationRequested) {
                return null;
            }

            // Cache the result
            this.setCachedCompletion(cacheKey, completion);

            return [
                new vscode.InlineCompletionItem(
                    completion,
                    new vscode.Range(position, position)
                )
            ];

        } catch (error) {
            Logger.error('Error in provideInlineCompletionItems:', error);
            return null;
        }
    }

    /**
     * Gera completion inline usando IA otimizada
     */
    private async generateInlineCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        textBefore: string,
        textAfter: string
    ): Promise<string | null> {
        try {
            const context = this.contextService.getCurrentContext();
            const config = this.configService.getConfig();

            // Obter contexto ao redor da posição atual (configurável)
            const contextLines = Math.floor(config.inlineCompletion.maxContextLines / 2);
            const startLine = Math.max(0, position.line - contextLines);
            const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
            const surroundingCode = document.getText(
                new vscode.Range(startLine, 0, endLine, 0)
            );

            const prompt = `
Complete o código seguinte de forma inteligente e contextual:

Linguagem: ${document.languageId}
Arquivo: ${context?.fileName || 'unknown'}

Código ao redor:
\`\`\`${document.languageId}
${surroundingCode}
\`\`\`

Complete a linha atual:`;

            // Use optimized completion endpoint
            const result = await this.backendService.requestCodeCompletion({
                prompt,
                context: surroundingCode,
                language: document.languageId,
                textBefore,
                textAfter
            });

            Logger.debug(`Completion generated in ${result.duration}ms (cached: ${result.cached})`);

            if (!result.completion) {
                return null;
            }

            // Validar que não é apenas repetição do texto existente
            if (result.completion === textBefore || result.completion.length < 2) {
                return null;
            }

            return result.completion;

        } catch (error) {
            Logger.error('Error generating inline completion:', error);
            
            // Fallback to simple completion if API fails
            return this.generateFallbackCompletion(textBefore, document.languageId);
        }
    }

    /**
     * Verifica se está dentro de string ou comentário
     */
    private isInStringOrComment(text: string): boolean {
        // Verificação simples para strings e comentários
        const inString = (text.match(/"/g) || []).length % 2 === 1 ||
            (text.match(/'/g) || []).length % 2 === 1 ||
            (text.match(/`/g) || []).length % 2 === 1;

        const inComment = text.includes('//') || text.includes('/*') || text.includes('#');

        return inString || inComment;
    }

    /**
     * Generates cache key for completion request
     */
    private generateCacheKey(textBefore: string, textAfter: string, language: string): string {
        const key = `${language}:${textBefore.trim()}:${textAfter.trim()}`;
        return crypto.createHash('sha256').update(key).digest('hex').substring(0, 50); // Limit key length
    }

    /**
     * Get cached completion if available and not expired
     */
    private getCachedCompletion(key: string): string | null {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        // Check if expired
        if (Date.now() - cached.timestamp > this.cacheExpiryMs) {
            this.cache.delete(key); // Remove expired entry
            return null;
        }

        return cached.completion;
    }

    /**
     * Cache completion result
     */
    private setCachedCompletion(key: string, completion: string): void {
        this.cache.set(key, {
            completion,
            timestamp: Date.now()
        });
    }

    /**
     * Generate simple fallback completion when API fails
     */
    private generateFallbackCompletion(textBefore: string, language: string): string | null {
        // Don't trim for pattern matching since we need trailing spaces
        const text = textBefore;
        
        // Simple pattern-based completions for common cases
        if (language === 'javascript' || language === 'typescript') {
            if (text.endsWith('console.')) {
                return 'log()';
            }
            if (text.endsWith('function ')) {
                return 'name() {\n    \n}';
            }
            if (text.endsWith('const ')) {
                return 'variable = ';
            }
            if (text.endsWith('if (')) {
                return 'condition) {\n    \n}';
            }
        }

        if (language === 'python') {
            if (text.endsWith('def ')) {
                return 'function_name():';
            }
            if (text.endsWith('if ')) {
                return 'condition:';
            }
            if (text.endsWith('print(')) {
                return '"")';
            }
        }

        return null;
    }

    /**
     * Habilita/desabilita o serviço
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        Logger.info(`Inline completion ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Verifica se está habilitado
     */
    isServiceEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get performance statistics
     */
    getStats(): { requestCount: number; cacheHits: number; cacheHitRate: number; cacheStats: any } {
        return {
            requestCount: this.requestCount,
            cacheHits: this.cacheHits,
            cacheHitRate: this.requestCount > 0 ? (this.cacheHits / this.requestCount) * 100 : 0,
            cacheStats: this.cache.stats()
        };
    }

    /**
     * Clear completion cache
     */
    clearCache(): void {
        this.cache.clear();
        this.cacheHits = 0;
        this.requestCount = 0;
        Logger.info('Inline completion cache cleared');
    }

    /**
     * Obtém disposables para cleanup
     */
    getDisposables(): vscode.Disposable[] {
        return this.disposables;
    }

    /**
     * Limpa recursos
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.cache.clear();
        Logger.info('Inline completion service disposed');
    }
}
