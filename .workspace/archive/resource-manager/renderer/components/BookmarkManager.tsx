import React, { useState, useEffect } from 'react';
import { Bookmark } from '../../shared/types';
import { formatRelativeTime, extractUrlsFromText } from '../../shared/utils';

// Declare global electronAPI
declare global {
  interface Window {
    electronAPI: {
      addBookmarks: (urls: string[], tags?: string[]) => Promise<any[]>;
      getAllBookmarks: () => Promise<Bookmark[]>;
      getBookmarkById: (id: string) => Promise<Bookmark | null>;
      updateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<boolean>;
      deleteBookmark: (id: string) => Promise<boolean>;
      exportBookmarks: () => Promise<boolean>;
      importBookmarks: () => Promise<number>;
      getAllTags: () => Promise<string[]>;
      onProgress: (callback: (status: any) => void) => () => void;
    };
  }
}

interface EditingBookmark extends Bookmark {
  newTag?: string;
}

export const BookmarkManager: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [editingBookmarks, setEditingBookmarks] = useState<Record<string, EditingBookmark>>({});

  // Load initial data
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.electronAPI.getAllBookmarks();
      setBookmarks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    try {
      // Extract URLs from the input text
      const extractedUrls = extractUrlsFromText(newUrl);
      
      // If no URLs found, treat the entire input as a single URL
      const urlsToAdd = extractedUrls.length > 0 ? extractedUrls : [newUrl.trim()];
      
      const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
      await window.electronAPI.addBookmarks(urlsToAdd, tags);
      
      setNewUrl('');
      setNewTags('');
      setShowAddForm(false);
      await loadBookmarks();
      
      // Show success message if multiple URLs were extracted
      if (extractedUrls.length > 1) {
        alert(`Successfully extracted and added ${extractedUrls.length} URLs!`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bookmark');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) {
      return;
    }

    try {
      const success = await window.electronAPI.deleteBookmark(id);
      if (success) {
        await loadBookmarks();
      } else {
        setError('Failed to delete bookmark');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bookmark');
    }
  };

  const handleExport = async () => {
    try {
      const success = await window.electronAPI.exportBookmarks();
      if (!success) {
        setError('Failed to export bookmarks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export bookmarks');
    }
  };

  const handleImport = async () => {
    try {
      const count = await window.electronAPI.importBookmarks();
      if (count > 0) {
        await loadBookmarks();
        alert(`Successfully imported ${count} bookmarks`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import bookmarks');
    }
  };

  const startEditing = (bookmark: Bookmark) => {
    setEditingBookmarks(prev => ({
      ...prev,
      [bookmark.id]: { ...bookmark, newTag: '' }
    }));
  };

  const cancelEditing = (id: string) => {
    setEditingBookmarks(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const updateEditingField = (id: string, field: string, value: any) => {
    setEditingBookmarks(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...(field.includes('.') 
          ? { metadata: { ...prev[id].metadata, [field.split('.')[1]]: value } }
          : { [field]: value }
        )
      }
    }));
  };

  const addTag = (id: string) => {
    const editing = editingBookmarks[id];
    if (!editing?.newTag?.trim()) return;

    const newTag = editing.newTag.trim().toLowerCase();
    if (!editing.tags.includes(newTag)) {
      updateEditingField(id, 'tags', [...editing.tags, newTag]);
    }
    updateEditingField(id, 'newTag', '');
  };

  const removeTag = (id: string, tagToRemove: string) => {
    const editing = editingBookmarks[id];
    if (!editing) return;
    
    updateEditingField(id, 'tags', editing.tags.filter(tag => tag !== tagToRemove));
  };

  const saveBookmark = async (id: string) => {
    const editing = editingBookmarks[id];
    if (!editing) return;

    try {
      const { newTag, ...updates } = editing;
      const success = await window.electronAPI.updateBookmark(id, updates);
      if (success) {
        await loadBookmarks();
        cancelEditing(id);
      } else {
        setError('Failed to save bookmark');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bookmark');
    }
  };

  const renderField = (label: string, value: string | null, id: string, field: string, type: 'input' | 'textarea' = 'input') => {
    const editing = editingBookmarks[id];
    const isEditing = !!editing;
    const currentValue = isEditing 
      ? (field.includes('.') 
          ? editing.metadata[field.split('.')[1] as keyof typeof editing.metadata] 
          : editing[field as keyof EditingBookmark])
      : value;

    return (
      <div style={{ display: 'flex', marginBottom: '8px', alignItems: type === 'textarea' ? 'flex-start' : 'center' }}>
        <div style={{ 
          minWidth: '120px', 
          fontWeight: '500', 
          color: '#6c757d', 
          fontSize: '12px',
          paddingRight: '12px',
          paddingTop: type === 'textarea' ? '8px' : '0'
        }}>
          {label}:
        </div>
        <div style={{ flex: 1 }}>
          {isEditing ? (
            type === 'textarea' ? (
              <textarea
                className="textarea"
                value={currentValue as string || ''}
                onChange={(e) => updateEditingField(id, field, e.target.value)}
                style={{ minHeight: '60px', fontSize: '13px' }}
              />
            ) : (
              <input
                className="input"
                value={currentValue as string || ''}
                onChange={(e) => updateEditingField(id, field, e.target.value)}
                style={{ fontSize: '13px' }}
              />
            )
          ) : (
            <div style={{ 
              fontSize: '13px', 
              color: value ? '#495057' : '#adb5bd',
              fontStyle: value ? 'normal' : 'italic',
              lineHeight: '1.4'
            }}>
              {value || 'Not available'}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading bookmarks...
      </div>
    );
  }

  return (
    <div className="bookmark-manager">
      {/* Header */}
      <header className="header">
        <h1 className="header-title">Resource Manager - Edit Test</h1>
        <div className="header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleImport}>
            Import
          </button>
          <button 
            className="btn btn-outline btn-sm" 
            onClick={handleExport}
            disabled={bookmarks.length === 0}
          >
            Export
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Bookmark'}
          </button>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="error">
          {error}
          <button
            style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'inherit' }}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
          <form onSubmit={handleAddBookmark}>
            <div className="form-group">
              <label className="form-label">URL(s) - Paste any text with links!</label>
              <textarea
                className="textarea"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste URLs, text with links, or enter a single URL...&#10;&#10;Examples:&#10;• https://example.com&#10;• Multiple URLs from copied text&#10;• Entire documents with embedded links&#10;&#10;URLs will be automatically extracted and added!"
                rows={6}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input
                type="text"
                className="input"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="tech, article, programming"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary">
                Add Bookmark
              </button>
              <button 
                type="button" 
                className="btn btn-outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bookmark List */}
      <div className="bookmark-list">
        {bookmarks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h3 className="empty-state-title">No bookmarks yet</h3>
            <p className="empty-state-text">
              Add your first bookmark to get started organizing your resources.
            </p>
          </div>
        ) : (
          bookmarks.map((bookmark) => {
            const isEditing = !!editingBookmarks[bookmark.id];
            const editing = editingBookmarks[bookmark.id] || bookmark;
            
            return (
              <div key={bookmark.id} className="bookmark-card">
                <div className="bookmark-header">
                  <h3 className="bookmark-title">
                    {isEditing ? (
                      <input
                        className="input"
                        value={editing.title}
                        onChange={(e) => updateEditingField(bookmark.id, 'title', e.target.value)}
                        style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}
                      />
                    ) : (
                      bookmark.title
                    )}
                  </h3>
                  <div className="bookmark-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveBookmark(bookmark.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => cancelEditing(bookmark.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => window.open(bookmark.url, '_blank')}
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startEditing(bookmark)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDeleteBookmark(bookmark.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* URL */}
                <div style={{ marginBottom: '16px' }}>
                  {renderField('URL', bookmark.url, bookmark.id, 'url')}
                </div>

                {/* Metadata Fields */}
                <div style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '16px', 
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                    Metadata
                  </h4>
                  {renderField('Description', bookmark.metadata.meta_description, bookmark.id, 'metadata.meta_description', 'textarea')}
                  {renderField('Text Preview', bookmark.metadata.text_preview, bookmark.id, 'metadata.text_preview', 'textarea')}
                  {renderField('Author', bookmark.metadata.author, bookmark.id, 'metadata.author')}
                  {renderField('Language', bookmark.metadata.lang, bookmark.id, 'metadata.lang')}
                  {renderField('Word Count', bookmark.metadata.word_count?.toString(), bookmark.id, 'metadata.word_count')}
                  {renderField('Image URL', bookmark.metadata.meta_image, bookmark.id, 'metadata.meta_image')}
                  {renderField('Publish Date', bookmark.metadata.publish_date, bookmark.id, 'metadata.publish_date')}
                </div>

                {/* Tags */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      minWidth: '120px', 
                      fontWeight: '500', 
                      color: '#6c757d', 
                      fontSize: '12px',
                      paddingRight: '12px'
                    }}>
                      Tags:
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="tag-list">
                        {editing.tags.map((tag) => (
                          <span key={tag} className="tag" style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {tag}
                            {isEditing && (
                              <button
                                onClick={() => removeTag(bookmark.id, tag)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'inherit',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '0',
                                  marginLeft: '4px'
                                }}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {isEditing && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '132px' }}>
                      <input
                        className="input"
                        placeholder="Add tag..."
                        value={editing.newTag || ''}
                        onChange={(e) => updateEditingField(bookmark.id, 'newTag', e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(bookmark.id);
                          }
                        }}
                        style={{ fontSize: '12px', flex: 1 }}
                      />
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => addTag(bookmark.id)}
                        disabled={!editing.newTag?.trim()}
                      >
                        Add Tag
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bookmark-meta">
                  <span className="bookmark-date">
                    Added {formatRelativeTime(bookmark.date_added)}
                  </span>
                  <span>
                    {bookmark.extraction_status === 'failed' && '⚠️ '}
                    {bookmark.metadata.word_count > 0 && `${bookmark.metadata.word_count} words`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}; 