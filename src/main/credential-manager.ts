import { safeStorage } from 'electron';
import { Buffer } from 'node:buffer';
import * as fs from 'fs';
import * as path from 'path';
import { CredentialStore, Platform } from '../types';

export class CredentialManager {
  private static instance: CredentialManager;
  private workspacePath: string | null = null;
  private credentials: Map<string, string> = new Map();
  private credentialsLoaded = false;

  private constructor() {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Encryption not available - credentials will be stored in plain text');
    }
  }

  public static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Set the workspace path and load credentials for this workspace
   */
  public async setWorkspace(workspacePath: string): Promise<void> {
    if (this.workspacePath === workspacePath && this.credentialsLoaded) {
      return; // Already loaded for this workspace
    }

    this.workspacePath = workspacePath;
    this.credentials.clear();
    this.credentialsLoaded = false;

    // Ensure .meridian/config directory exists
    const configDir = path.join(workspacePath, '.meridian', 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing credentials
    await this.loadCredentials();
  }

  /**
   * Check if workspace is set
   */
  public isWorkspaceSet(): boolean {
    return this.workspacePath !== null;
  }

  /**
   * Get current workspace path
   */
  public getWorkspacePath(): string | null {
    return this.workspacePath;
  }

  /**
   * Load credentials from workspace file
   */
  private async loadCredentials(): Promise<void> {
    if (!this.workspacePath) {
      throw new Error('No workspace set - cannot load credentials');
    }

    const credentialsFile = path.join(this.workspacePath, '.meridian', 'config', 'credentials.json');
    
    if (!fs.existsSync(credentialsFile)) {
      this.credentialsLoaded = true;
      return; // No credentials file yet
    }

    try {
      const encryptedData = fs.readFileSync(credentialsFile, 'utf8');
      
      if (encryptedData.trim()) {
        let decryptedData: string;
        
        if (safeStorage.isEncryptionAvailable()) {
          const encryptedBuffer = Buffer.from(encryptedData, 'base64');
          decryptedData = safeStorage.decryptString(encryptedBuffer);
        } else {
          // Fallback for development
          decryptedData = Buffer.from(encryptedData, 'base64').toString();
        }

        const credentialsData = JSON.parse(decryptedData);
        this.credentials = new Map(Object.entries(credentialsData));
      }

      this.credentialsLoaded = true;
      console.log(`Loaded credentials for workspace: ${this.workspacePath}`);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      this.credentials.clear();
      this.credentialsLoaded = true;
    }
  }

  /**
   * Save credentials to workspace file
   */
  private async saveCredentials(): Promise<void> {
    if (!this.workspacePath) {
      throw new Error('No workspace set - cannot save credentials');
    }

    const credentialsFile = path.join(this.workspacePath, '.meridian', 'config', 'credentials.json');
    const credentialsData = Object.fromEntries(this.credentials);
    const jsonData = JSON.stringify(credentialsData);

    try {
      let encryptedData: string;
      
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(jsonData);
        encryptedData = encrypted.toString('base64');
      } else {
        // Fallback for development
        encryptedData = Buffer.from(jsonData).toString('base64');
      }

      fs.writeFileSync(credentialsFile, encryptedData, { mode: 0o600 });
      console.log(`Saved credentials for workspace: ${this.workspacePath}`);
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw new Error(`Failed to save credentials: ${error}`);
    }
  }

  /**
   * Store encrypted credentials for a platform
   */
  public async setCredential(service: Platform | 'arweave', key: string, value: string): Promise<void> {
    if (!this.workspacePath) {
      throw new Error('No workspace connected. Please select a workspace before setting up credentials.');
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    try {
      const credentialKey = `${service}:${key}`;
      this.credentials.set(credentialKey, value);
      await this.saveCredentials();
      console.log(`Credential stored for ${service}:${key} in workspace: ${this.workspacePath}`);
    } catch (error) {
      console.error(`Failed to store credential for ${service}:${key}:`, error);
      throw new Error(`Failed to store credential: ${error}`);
    }
  }

  /**
   * Retrieve credentials for a platform
   */
  public async getCredential(service: Platform | 'arweave', key: string): Promise<string | null> {
    if (!this.workspacePath) {
      return null; // No workspace = no credentials
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    try {
      const credentialKey = `${service}:${key}`;
      return this.credentials.get(credentialKey) || null;
    } catch (error) {
      console.error(`Failed to retrieve credential for ${service}:${key}:`, error);
      return null;
    }
  }

  /**
   * Remove stored credentials for a platform
   */
  public async removeCredential(service: Platform | 'arweave', key: string): Promise<void> {
    if (!this.workspacePath) {
      return; // No workspace = nothing to remove
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    const credentialKey = `${service}:${key}`;
    this.credentials.delete(credentialKey);
    await this.saveCredentials();
    console.log(`Credential removed for ${service}:${key} from workspace: ${this.workspacePath}`);
  }

  /**
   * List available credential keys for a service
   */
  public async listCredentials(service: Platform | 'arweave'): Promise<string[]> {
    if (!this.workspacePath) {
      return [];
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    const servicePrefix = `${service}:`;
    return Array.from(this.credentials.keys())
      .filter(key => key.startsWith(servicePrefix))
      .map(key => key.substring(servicePrefix.length));
  }

  /**
   * Get all credentials matching a pattern
   */
  public async getCredentialsByPattern(pattern: string): Promise<Map<string, string>> {
    if (!this.workspacePath) {
      return new Map();
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    const results = new Map<string, string>();
    for (const [key, value] of this.credentials.entries()) {
      if (key.includes(pattern)) {
        results.set(key, value);
      }
    }
    return results;
  }

  /**
   * Remove all credentials matching a pattern
   */
  public async removeCredentialsByPattern(pattern: string): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    if (!this.credentialsLoaded) {
      await this.loadCredentials();
    }

    const keysToRemove = Array.from(this.credentials.keys()).filter(key => key.includes(pattern));
    for (const key of keysToRemove) {
      this.credentials.delete(key);
    }
    
    if (keysToRemove.length > 0) {
      await this.saveCredentials();
      console.log(`Removed ${keysToRemove.length} credentials matching pattern: ${pattern}`);
    }
  }

  /**
   * Get all credentials for a platform
   */
  public async getPlatformCredentials(service: Platform): Promise<Record<string, string>> {
    const keys = await this.listCredentials(service);
    const credentials: Record<string, string> = {};

    for (const key of keys) {
      const value = await this.getCredential(service, key);
      if (value) {
        credentials[key] = value;
      }
    }

    return credentials;
  }

  /**
   * Store multiple credentials for a platform at once
   */
  public async setPlatformCredentials(service: Platform | 'arweave', credentials: Record<string, string>): Promise<void> {
    const promises = Object.entries(credentials).map(([key, value]) =>
      this.setCredential(service, key, value)
    );
    
    await Promise.all(promises);
  }

  /**
   * Validate that required credentials exist for a platform
   */
  public async validatePlatformCredentials(service: Platform): Promise<boolean> {
    if (!this.workspacePath) {
      return false;
    }

    const requiredKeys = this.getRequiredCredentialKeys(service);
    
    for (const key of requiredKeys) {
      const credential = await this.getCredential(service, key);
      if (!credential) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get required credential keys for each platform
   */
  private getRequiredCredentialKeys(service: Platform): string[] {
    switch (service) {
      case 'bluesky':
        return ['jwt', 'refreshToken'];
      case 'farcaster':
        return ['appKey', 'jwt'];
      case 'twitter':
        return ['accessToken', 'refreshToken'];
      case 'x':
        return ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'];
      default:
        return [];
    }
  }

  /**
   * Clear all credentials for current workspace
   */
  public async clearAllCredentials(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    this.credentials.clear();
    await this.saveCredentials();
    console.log(`All credentials cleared for workspace: ${this.workspacePath}`);
  }

  /**
   * Check if encryption is available
   */
  public isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }
} 