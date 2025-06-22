import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TemplateVariable, MarkdownFile, ValidationResult } from '../types';

export class TemplateEngine {
  private variableRegex = /\{\{(\w+)\}\}/g;

  /**
   * Parse template string and extract variables
   */
  parseTemplate(template: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const matches = Array.from(template.matchAll(this.variableRegex));
    const uniqueKeys = new Set<string>();

    for (const match of matches) {
      const key = match[1];
      if (key && !uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        variables.push({
          key,
          label: this.formatLabel(key),
          type: this.inferVariableType(key),
          required: true,
          source: this.inferVariableSource(key),
          frontmatterKey: key,
        });
      }
    }

    return variables;
  }

  /**
   * Render template with provided variables
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(this.variableRegex, (match, key) => {
      const value = variables[key];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Extract variables from markdown frontmatter
   */
  async extractFrontmatterVariables(filePath: string): Promise<Record<string, string>> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const frontmatter = this.extractFrontmatter(content);
      
      // Convert all values to strings
      const variables: Record<string, string> = {};
      for (const [key, value] of Object.entries(frontmatter)) {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            variables[key] = value.join(', ');
          } else if (typeof value === 'object') {
            variables[key] = JSON.stringify(value);
          } else {
            variables[key] = String(value);
          }
        }
      }
      
      return variables;
    } catch (error) {
      console.warn(`Failed to extract frontmatter from ${filePath}:`, error);
      return {};
    }
  }

  /**
   * Generate URL for markdown file (assuming Quartz integration)
   */
  generateFileUrl(filePath: string, baseUrl?: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const urlPath = relativePath
      .replace(/^content\//, '') // Remove content/ prefix
      .replace(/\.md$/, '') // Remove .md extension
      .replace(/\\/g, '/'); // Normalize path separators
    
    const base = baseUrl || 'https://example.com';
    return `${base}/${urlPath}`;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for malformed variable syntax
    const malformedMatches = template.match(/\{[^{]|\}[^}]|\{[^}]*$|^[^{]*\}/g);
    if (malformedMatches) {
      errors.push('Template contains malformed variable syntax. Use {{variable}} format.');
    }

    // Check for empty variables
    const emptyMatches = template.match(/\{\{\s*\}\}/g);
    if (emptyMatches) {
      errors.push('Template contains empty variables {{}}.');
    }

    // Check for nested variables
    const nestedMatches = template.match(/\{\{[^}]*\{\{[^}]*\}\}[^}]*\}\}/g);
    if (nestedMatches) {
      warnings.push('Template may contain nested variables which are not supported.');
    }

    // Extract and validate variable names
    const variables = this.parseTemplate(template);
    for (const variable of variables) {
      if (variable.key && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.key)) {
        errors.push(`Invalid variable name: ${variable.key}. Use alphanumeric characters and underscores only.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract frontmatter from markdown content
   */
  private extractFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    try {
      const result = frontmatterMatch[1] ? yaml.load(frontmatterMatch[1]) : null;
      return (result && typeof result === 'object') ? result as Record<string, any> : {};
    } catch (error) {
      console.warn('Failed to parse frontmatter YAML:', error);
      return {};
    }
  }

  /**
   * Format variable key into human-readable label
   */
  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/_/g, ' '); // Replace underscores with spaces
  }

  /**
   * Infer variable type from key name
   */
  private inferVariableType(key: string): TemplateVariable['type'] {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes('url') || lowerKey.includes('link')) {
      return 'url';
    }
    if (lowerKey.includes('date') || lowerKey.includes('time')) {
      return 'date';
    }
    if (lowerKey.includes('count') || lowerKey.includes('number') || lowerKey.includes('num')) {
      return 'number';
    }
    
    return 'text';
  }

  /**
   * Infer variable source from key name
   */
  private inferVariableSource(key: string): TemplateVariable['source'] {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey === 'url') {
      return 'computed';
    }
    if (['title', 'author', 'date', 'description', 'tags'].includes(lowerKey)) {
      return 'frontmatter';
    }
    
    return 'user';
  }
} 