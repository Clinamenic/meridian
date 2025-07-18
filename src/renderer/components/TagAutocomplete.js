/**
 * Unified TagAutocomplete class to replace all duplicate tag autocomplete implementations
 * Handles: Modal tags, Resource tags, Archive tags, Bulk tags, etc.
 */
export class TagAutocomplete {
  constructor(config) {
    this.inputSelector = config.inputSelector;
    this.autocompleteSelector = config.autocompleteSelector;
    this.getSuggestions = config.getSuggestions;
    this.onTagSelect = config.onTagSelect;
    this.onInputChange = config.onInputChange;
    this.excludeTags = config.excludeTags || [];
    this.maxSuggestions = config.maxSuggestions || 8;
    this.minInputLength = config.minInputLength || 1;
    
    // Get DOM elements
    this.input = document.querySelector(this.inputSelector);
    this.autocompleteContainer = document.querySelector(this.autocompleteSelector);
    
    if (!this.input || !this.autocompleteContainer) {
      console.warn('[TagAutocomplete] Could not find required elements:', {
        input: this.inputSelector,
        autocomplete: this.autocompleteSelector
      });
      return;
    }
    
    this.setupEvents();
  }
  
  setupEvents() {
    // Input event for showing suggestions
    this.input.addEventListener('input', (e) => {
      this.show(e.target.value);
      if (this.onInputChange) {
        this.onInputChange(e.target);
      }
    });
    
    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim();
        if (value && this.onTagSelect) {
          this.onTagSelect(value);
        }
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });
    
    // Hide on blur (with delay for clicks)
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.hide(), 200);
    });
  }
  
  show(inputValue) {
    const value = inputValue.trim().toLowerCase();
    
    if (value.length < this.minInputLength) {
      this.hide();
      return;
    }
    
    // Get suggestions from the provided function
    const suggestions = this.getSuggestions(value, this.excludeTags, this.maxSuggestions);
    
    if (suggestions.length === 0) {
      this.hide();
      return;
    }
    
    // Render suggestions
    this.autocompleteContainer.innerHTML = suggestions
      .map(tag => `
        <div class="autocomplete-item" data-tag="${this.escapeHtml(tag)}">
          ${this.escapeHtml(tag)}
        </div>
      `).join('');
    
    // Add click events
    this.autocompleteContainer.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        if (this.onTagSelect) {
          this.onTagSelect(tag);
        }
      });
    });
    
    this.autocompleteContainer.style.display = 'block';
  }
  
  hide() {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.style.display = 'none';
    }
  }
  
  updateExcludeTags(tags) {
    this.excludeTags = tags || [];
  }
  
  cleanup() {
    // Remove event listeners if needed
    if (this.input) {
      this.input.removeEventListener('input', this.show);
      this.input.removeEventListener('keydown', this.handleKeydown);
      this.input.removeEventListener('blur', this.handleBlur);
    }
  }
  
  // Utility method for HTML escaping
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 