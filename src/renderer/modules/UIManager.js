import { ModuleBase } from './ModuleBase.js';

/**
 * UIManager - Centralized UI utilities for notifications, formatting, and clipboard
 */
export class UIManager extends ModuleBase {
  constructor() {
    super();
  }

  // ===== Notification Methods =====
  static showSuccess(message) {
    UIManager.showNotification(message, 'success');
  }

  static showError(message) {
    UIManager.showNotification(message, 'error');
  }

  static showNotification(message, type) {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background-color: ${type === 'success' ? 'var(--success-color)' : 'var(--error-color)'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // ===== Formatting Methods =====
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatFileTypeCounts(fileTypes) {
    if (!fileTypes || Object.keys(fileTypes).length === 0) {
      return 'No files detected';
    }
    const sortedTypes = Object.entries(fileTypes)
      .sort(([a, countA], [b, countB]) => {
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      })
      .slice(0, 5);
    const formatted = sortedTypes.map(([ext, count]) => {
      const displayExt = ext === '(no ext)' ? 'no ext' : ext.replace('.', '');
      return `${count} ${displayExt}`;
    }).join(', ');
    const totalTypes = Object.keys(fileTypes).length;
    if (totalTypes > 5) {
      return `${formatted} (+${totalTypes - 5} more)`;
    }
    return formatted;
  }

  static formatFileTypesList(fileTypes) {
    if (!fileTypes || Object.keys(fileTypes).length === 0) {
      return '<div class="file-type-row"><span class="file-type-label">No files detected</span><span class="file-type-value">—</span></div>';
    }
    const sortedTypes = Object.entries(fileTypes)
      .sort(([a, countA], [b, countB]) => {
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      });
    return sortedTypes.map(([ext, count]) => {
      const displayExt = ext === '(no ext)' ? 'no ext' : ext.replace('.', '');
      return `
        <div class="file-type-row">
          <span class="file-type-label">${displayExt}</span>
          <span class="file-type-value">${count}</span>
        </div>
      `;
    }).join('');
  }

  static formatExclusionsList(contentSummary) {
    const exclusionRows = [];
    const detailedExclusions = contentSummary.detailedExclusions;
    if (detailedExclusions) {
      const dotDirs = detailedExclusions.dotDirectories || {};
      const sortedDotDirs = Object.entries(dotDirs)
        .sort(([a, countA], [b, countB]) => {
          if (countB !== countA) return countB - countA;
          return a.localeCompare(b);
        });
      for (const [dirName, count] of sortedDotDirs) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">${dirName}</span>
            <span class="file-type-value">${count}</span>
          </div>
        `);
      }
      const customPatterns = detailedExclusions.customPatterns || {};
      const sortedCustomPatterns = Object.entries(customPatterns)
        .sort(([a, countA], [b, countB]) => {
          if (countB !== countA) return countB - countA;
          return a.localeCompare(b);
        });
      for (const [pattern, count] of sortedCustomPatterns) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">${pattern}</span>
            <span class="file-type-value">${count}</span>
          </div>
        `);
      }
    }
    if (exclusionRows.length === 0 && contentSummary.exclusionSummary) {
      const summary = contentSummary.exclusionSummary;
      if (summary.dotDirectories > 0) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">Dot directories</span>
            <span class="file-type-value">${summary.dotDirectories}</span>
          </div>
        `);
      }
      if (summary.configFiles > 0) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">Config files</span>
            <span class="file-type-value">${summary.configFiles}</span>
          </div>
        `);
      }
      if (summary.developmentFiles > 0) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">Development files</span>
            <span class="file-type-value">${summary.developmentFiles}</span>
          </div>
        `);
      }
      if (summary.customIgnored > 0) {
        exclusionRows.push(`
          <div class="file-type-row">
            <span class="file-type-label">Custom ignored</span>
            <span class="file-type-value">${summary.customIgnored}</span>
          </div>
        `);
      }
    }
    return exclusionRows.join('');
  }

  static formatUTCTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace(/\.\d{3}Z$/, ' UTC');
    } catch (error) {
      return 'Invalid Date';
    }
  }

  static truncateHash(hash) {
    if (!hash || hash.length <= 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  }

  // ===== Clipboard Methods =====
  static async copyToClipboard(text, successMessage = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text);
      UIManager.showNotification(successMessage, 'success');
    } catch (error) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        UIManager.showNotification(successMessage, 'success');
      } catch (fallbackError) {
        UIManager.showNotification('Failed to copy to clipboard', 'error');
      }
    }
  }
} 