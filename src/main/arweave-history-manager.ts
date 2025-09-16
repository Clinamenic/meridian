import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ArweaveDeploymentHistory, ArweaveDeploymentHistoryRecord, ArweaveDeployResult } from '../types';

/**
 * Manages Arweave deployment history storage and retrieval
 * Stores deployment records in .meridian/data/site-history.json
 */
export class ArweaveHistoryManager {
    private workspacePath: string;
    private historyFilePath: string;
    private readonly SCHEMA_VERSION = '1.0';
    private readonly MAX_DEPLOYMENTS = 1000; // Prevent unbounded growth

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.historyFilePath = path.join(workspacePath, '.meridian', 'data', 'site-history.json');
    }

    /**
     * Load deployment history from file
     */
    public async loadHistory(): Promise<ArweaveDeploymentHistory> {
        try {
            await this.ensureHistoryFile();

            const historyData = await fs.readFile(this.historyFilePath, 'utf-8');
            const parsedHistory = JSON.parse(historyData);

            // Migrate if needed
            return this.migrateHistorySchema(parsedHistory);
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to load history:', error);
            // Return empty history on any error
            return this.createEmptyHistory();
        }
    }

    /**
     * Save deployment history to file
     */
    public async saveHistory(history: ArweaveDeploymentHistory): Promise<void> {
        try {
            await this.ensureHistoryFile();

            // Update last modified timestamp
            history.lastUpdated = new Date().toISOString();

            // Sort deployments by timestamp (newest first)
            history.deployments.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            // Limit deployments to prevent unbounded growth
            if (history.deployments.length > this.MAX_DEPLOYMENTS) {
                history.deployments = history.deployments.slice(0, this.MAX_DEPLOYMENTS);
            }

            const historyJson = JSON.stringify(history, null, 2);
            await fs.writeFile(this.historyFilePath, historyJson, 'utf-8');

            console.log(`[ArweaveHistoryManager] Saved ${history.deployments.length} deployment records`);
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to save history:', error);
            throw new Error(`Failed to save deployment history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Add a new deployment record
     */
    public async addDeployment(deployResult: ArweaveDeployResult, siteId: string, strategy: 'full' = 'full'): Promise<string> {
        try {
            const history = await this.loadHistory();

            const record: ArweaveDeploymentHistoryRecord = {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                siteId: siteId,
                manifestHash: deployResult.manifestHash || '',
                url: deployResult.url || '',
                manifestUrl: deployResult.manifestUrl,
                indexFileUrl: deployResult.indexFile?.url,
                totalCost: {
                    ar: deployResult.totalCost?.ar || '0',
                    usd: deployResult.totalCost?.usd
                },
                fileCount: deployResult.fileCount || 0,
                totalSize: deployResult.totalSize || 0,
                deploymentStrategy: strategy,
                status: deployResult.success ? 'success' : 'failed',
                error: deployResult.error,
                uploadedFiles: deployResult.uploadedFiles,
                metadata: {
                    userAgent: 'Meridian App',
                    version: process.env.npm_package_version || '0.1.0'
                }
            };

            history.deployments.unshift(record); // Add to beginning (newest first)
            await this.saveHistory(history);

            console.log(`[ArweaveHistoryManager] Added deployment record: ${record.id} for site: ${siteId}`);
            return record.id;
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to add deployment:', error);
            throw error;
        }
    }

    /**
     * Get deployment by ID
     */
    public async getDeploymentById(id: string): Promise<ArweaveDeploymentHistoryRecord | null> {
        try {
            const history = await this.loadHistory();
            return history.deployments.find(d => d.id === id) || null;
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to get deployment by ID:', error);
            return null;
        }
    }

    /**
     * Get all deployments for a specific site ID
     */
    public async getDeploymentsBySiteId(siteId: string): Promise<ArweaveDeploymentHistoryRecord[]> {
        try {
            const history = await this.loadHistory();
            return history.deployments.filter(d => d.siteId === siteId);
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to get deployments by site ID:', error);
            return [];
        }
    }

    /**
     * Get all deployment records
     */
    public async getAllDeployments(): Promise<ArweaveDeploymentHistoryRecord[]> {
        try {
            const history = await this.loadHistory();
            return history.deployments;
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to get all deployments:', error);
            return [];
        }
    }

    /**
     * Get recent deployments (last N deployments)
     */
    public async getRecentDeployments(limit: number = 10): Promise<ArweaveDeploymentHistoryRecord[]> {
        try {
            const history = await this.loadHistory();
            return history.deployments.slice(0, limit);
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to get recent deployments:', error);
            return [];
        }
    }

    /**
     * Delete a deployment record
     */
    public async deleteDeployment(id: string): Promise<boolean> {
        try {
            const history = await this.loadHistory();
            const initialLength = history.deployments.length;

            history.deployments = history.deployments.filter(d => d.id !== id);

            if (history.deployments.length < initialLength) {
                await this.saveHistory(history);
                console.log(`[ArweaveHistoryManager] Deleted deployment: ${id}`);
                return true;
            }

            return false; // Deployment not found
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to delete deployment:', error);
            return false;
        }
    }

    /**
     * Prune old deployment records
     */
    public async pruneHistory(maxAgeInDays: number): Promise<number> {
        try {
            const history = await this.loadHistory();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

            const initialLength = history.deployments.length;
            history.deployments = history.deployments.filter(d =>
                new Date(d.timestamp) > cutoffDate
            );

            const prunedCount = initialLength - history.deployments.length;

            if (prunedCount > 0) {
                await this.saveHistory(history);
                console.log(`[ArweaveHistoryManager] Pruned ${prunedCount} old deployment records`);
            }

            return prunedCount;
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to prune history:', error);
            return 0;
        }
    }

    /**
     * Export deployment history as JSON
     */
    public async exportHistory(): Promise<{ success: boolean; filePath?: string; error?: string }> {
        try {
            const history = await this.loadHistory();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFileName = `arweave-deployment-history-${timestamp}.json`;
            const exportPath = path.join(this.workspacePath, '.meridian', 'exports');

            // Ensure exports directory exists
            await fs.mkdir(exportPath, { recursive: true });

            const exportFilePath = path.join(exportPath, exportFileName);
            await fs.writeFile(exportFilePath, JSON.stringify(history, null, 2), 'utf-8');

            console.log(`[ArweaveHistoryManager] Exported history to: ${exportFilePath}`);
            return { success: true, filePath: exportFilePath };
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to export history:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get deployment statistics
     */
    public async getDeploymentStats(): Promise<{
        totalDeployments: number;
        successfulDeployments: number;
        failedDeployments: number;
        totalCostAR: string;
        totalFiles: number;
        totalSize: number;
        lastDeployment?: ArweaveDeploymentHistoryRecord;
    }> {
        try {
            const history = await this.loadHistory();
            const deployments = history.deployments;

            const successful = deployments.filter(d => d.status === 'success');
            const failed = deployments.filter(d => d.status === 'failed');

            const totalCostAR = successful.reduce((sum, d) => {
                const cost = parseFloat(d.totalCost.ar) || 0;
                return sum + cost;
            }, 0);

            const totalFiles = successful.reduce((sum, d) => sum + d.fileCount, 0);
            const totalSize = successful.reduce((sum, d) => sum + d.totalSize, 0);

            return {
                totalDeployments: deployments.length,
                successfulDeployments: successful.length,
                failedDeployments: failed.length,
                totalCostAR: totalCostAR.toFixed(6),
                totalFiles,
                totalSize,
                lastDeployment: deployments[0] // Already sorted newest first
            };
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to get deployment stats:', error);
            return {
                totalDeployments: 0,
                successfulDeployments: 0,
                failedDeployments: 0,
                totalCostAR: '0',
                totalFiles: 0,
                totalSize: 0
            };
        }
    }

    /**
     * Ensure history file exists
     */
    private async ensureHistoryFile(): Promise<void> {
        try {
            // Ensure .meridian/data directory exists
            const dataDir = path.dirname(this.historyFilePath);
            await fs.mkdir(dataDir, { recursive: true });

            // Check if file exists
            try {
                await fs.access(this.historyFilePath);
            } catch (error) {
                // File doesn't exist, create empty history
                const emptyHistory = this.createEmptyHistory();
                await fs.writeFile(this.historyFilePath, JSON.stringify(emptyHistory, null, 2), 'utf-8');
                console.log('[ArweaveHistoryManager] Created new history file');
            }
        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to ensure history file:', error);
            throw error;
        }
    }

    /**
     * Create empty history structure
     */
    private createEmptyHistory(): ArweaveDeploymentHistory {
        return {
            version: this.SCHEMA_VERSION,
            deployments: [],
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Migrate history schema if needed
     */
    private migrateHistorySchema(history: any): ArweaveDeploymentHistory {
        try {
            // Handle missing version (assume 1.0)
            if (!history.version) {
                history.version = this.SCHEMA_VERSION;
            }

            // Ensure required properties exist
            if (!history.deployments) {
                history.deployments = [];
            }

            if (!history.lastUpdated) {
                history.lastUpdated = new Date().toISOString();
            }

            // Validate deployment records
            history.deployments = history.deployments.filter((d: any) => {
                return d && d.id && d.timestamp && d.siteId && d.manifestHash;
            });

            // Add any missing required fields to existing records
            history.deployments = history.deployments.map((d: any) => ({
                id: d.id,
                timestamp: d.timestamp,
                siteId: d.siteId,
                manifestHash: d.manifestHash,
                url: d.url || '',
                manifestUrl: d.manifestUrl,
                indexFileUrl: d.indexFileUrl,
                totalCost: {
                    ar: d.totalCost?.ar || '0',
                    usd: d.totalCost?.usd
                },
                fileCount: d.fileCount || 0,
                totalSize: d.totalSize || 0,
                deploymentStrategy: d.deploymentStrategy || 'full',
                status: d.status || 'success',
                error: d.error,
                uploadedFiles: d.uploadedFiles,
                metadata: d.metadata
            }));

            console.log(`[ArweaveHistoryManager] Loaded and validated ${history.deployments.length} deployment records`);
            return history as ArweaveDeploymentHistory;

        } catch (error) {
            console.error('[ArweaveHistoryManager] Failed to migrate history schema:', error);
            // Return empty history if migration fails
            return this.createEmptyHistory();
        }
    }
}

