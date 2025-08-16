import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ConfigurationService } from './ConfigurationService';

/**
 * Service for managing vector embeddings and semantic search for workspace content
 */
export class VectorEmbeddingService {
    private static instance: VectorEmbeddingService;
    private configService: ConfigurationService;
    private embeddings: Map<string, any> = new Map();
    private isIndexing: boolean = false;
    private lastIndexTime: Date | null = null;

    private constructor() {
        this.configService = ConfigurationService.getInstance();
    }

    static getInstance(): VectorEmbeddingService {
        if (!VectorEmbeddingService.instance) {
            VectorEmbeddingService.instance = new VectorEmbeddingService();
        }
        return VectorEmbeddingService.instance;
    }

    /**
     * Initialize and index workspace content
     */
    async initializeWorkspace(): Promise<void> {
        if (this.isIndexing) {
            Logger.warn('Workspace indexing already in progress');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            Logger.warn('No workspace folders found');
            return;
        }

        this.isIndexing = true;
        Logger.info('Starting workspace indexing for vector embeddings');

        try {
            for (const folder of workspaceFolders) {
                await this.indexWorkspaceFolder(folder.uri.fsPath);
            }
            this.lastIndexTime = new Date();
            Logger.info(`Workspace indexing completed. Indexed ${this.embeddings.size} files`);
        } catch (error) {
            Logger.error('Error during workspace indexing:', error);
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Index a specific workspace folder
     */
    private async indexWorkspaceFolder(folderPath: string): Promise<void> {
        const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.go', '.rs', '.rb', '.swift', '.kt', '.md', '.json', '.yml', '.yaml'];

        try {
            const files = await this.getFilesRecursively(folderPath, supportedExtensions);

            for (const filePath of files) {
                try {
                    await this.indexFile(filePath);
                } catch (error) {
                    Logger.warn(`Failed to index file ${filePath}:`, error);
                }
            }
        } catch (error) {
            Logger.error(`Error indexing folder ${folderPath}:`, error);
        }
    }

    /**
     * Get files recursively from a directory
     */
    private async getFilesRecursively(dirPath: string, supportedExtensions: string[]): Promise<string[]> {
        const files: string[] = [];
        const excludePatterns = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.vscode'];

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip excluded directories
                    if (!excludePatterns.some(pattern => entry.name.includes(pattern))) {
                        const subFiles = await this.getFilesRecursively(fullPath, supportedExtensions);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (supportedExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            Logger.warn(`Error reading directory ${dirPath}:`, error);
        }

        return files;
    }

    /**
     * Index a single file
     */
    private async indexFile(filePath: string): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const stats = await fs.promises.stat(filePath);

            // Skip very large files (>configured limit)
            const cfg: any = this.configService as any;
            const maxFileSize = typeof cfg.getMaxFileSizeForIndexing === 'function'
                ? cfg.getMaxFileSizeForIndexing()
                : 100 * 1024; // fallback to 100KB if not configured
            if (stats.size > maxFileSize) {
                Logger.debug(`Skipping large file: ${filePath} (size: ${stats.size} bytes, limit: ${maxFileSize} bytes)`);
                return;
            }

            // Create chunks for large content
            const chunks = this.createContentChunks(content);

            // Generate embeddings (mock implementation - in real scenario would call OpenAI embeddings API)
            const embeddings = await this.generateEmbeddings(content);

            const vectorEmbedding: any = {
                id: this.generateFileId(filePath),
                filePath,
                content,
                embeddings,
                metadata: {
                    fileType: path.extname(filePath),
                    size: stats.size,
                    lastModified: stats.mtime,
                    chunks: chunks.length > 1 ? chunks : undefined
                }
            };

            this.embeddings.set(filePath, vectorEmbedding);

            // Send to Elasticsearch for persistence
            await this.sendToElasticsearch(vectorEmbedding);

        } catch (error) {
            Logger.error(`Error indexing file ${filePath}:`, error);
        }
    }

    /**
     * Create content chunks for large files
     */
    private createContentChunks(content: string, maxChunkSize: number = 1000): string[] {
        if (content.length <= maxChunkSize) {
            return [content];
        }

        const chunks: string[] = [];
        const lines = content.split('\n');
        let currentChunk = '';

        for (const line of lines) {
            if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Generate embeddings for content (mock implementation)
     * In a real implementation, this would call OpenAI's embeddings API
     */
    private async generateEmbeddings(content: string): Promise<number[]> {
        // Mock implementation - generates a deterministic vector based on content
        const vector: number[] = [];
        const vectorSize = 384; // Common embedding size

        // Simple hash-based vector generation for demonstration
        for (let i = 0; i < vectorSize; i++) {
            let hash = 0;
            const str = content + i.toString();
            for (let j = 0; j < str.length; j++) {
                const char = str.charCodeAt(j);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            vector.push((hash % 2000 - 1000) / 1000); // Normalize to [-1, 1]
        }

        return vector;
    }

    /**
     * Send embedding to Elasticsearch
     */
    private async sendToElasticsearch(embedding: any): Promise<void> {
        try {
            const backendUrl = this.configService.getBackendUrl().replace('/openai', '/embeddings');

            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: embedding.id,
                    filePath: embedding.filePath,
                    content: embedding.content,
                    embeddings: embedding.embeddings,
                    metadata: embedding.metadata
                })
            });

            if (!response.ok) {
                Logger.warn(`Failed to send embedding to Elasticsearch: ${response.statusText}`);
            }
        } catch (error) {
            Logger.error('Error sending embedding to Elasticsearch:', error);
        }
    }

    /**
     * Retrieve relevant context based on a query
     */
    async retrieveRelevantContext(query: string, maxResults: number = 5): Promise<any> {
        const queryEmbeddings = await this.generateEmbeddings(query);
        const scores: Array<{ filePath: string; score: number; content: string }> = [];

        // Calculate similarity scores
        for (const [filePath, embedding] of this.embeddings) {
            const similarity = this.calculateCosineSimilarity(queryEmbeddings, embedding.embeddings);
            scores.push({
                filePath,
                score: similarity,
                content: embedding.content
            });
        }

        // Sort by score and take top results
        scores.sort((a, b) => b.score - a.score);
        const topResults = scores.slice(0, maxResults);

        return {
            relevantFiles: topResults.map(r => r.filePath),
            relevantContent: topResults.map(r => r.content),
            embeddingScores: topResults.map(r => r.score),
            totalScore: topResults.reduce((sum, r) => sum + r.score, 0)
        };
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
        if (vectorA.length !== vectorB.length) {
            return 0;
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            magnitudeA += vectorA[i] * vectorA[i];
            magnitudeB += vectorB[i] * vectorB[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Generate file ID from path
     */
    private generateFileId(filePath: string): string {
        return Buffer.from(filePath).toString('base64').replace(/[+/=]/g, '');
    }

    /**
     * Check if workspace is indexed
     */
    isWorkspaceIndexed(): boolean {
        return this.lastIndexTime !== null && this.embeddings.size > 0;
    }

    /**
     * Get indexing status
     */
    getIndexingStatus(): { isIndexing: boolean; lastIndexTime: Date | null; indexedFiles: number } {
        return {
            isIndexing: this.isIndexing,
            lastIndexTime: this.lastIndexTime,
            indexedFiles: this.embeddings.size
        };
    }

    /**
     * Re-index workspace if needed
     */
    async reindexIfNeeded(): Promise<void> {
        if (!this.lastIndexTime || Date.now() - this.lastIndexTime.getTime() > 24 * 60 * 60 * 1000) {
            Logger.info('Re-indexing workspace due to age');
            await this.initializeWorkspace();
        }
    }
}

