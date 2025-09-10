# Implementation Plan: Local-First Electron Bookmark Manager

## Overview

Building a local-first Electron desktop application for URL bookmarking with automatic metadata extraction, tagging, and JSON document storage. The app will handle thousands of bookmarks efficiently with a modern, secure interface.

---

## Architecture Decisions

### Storage Strategy

- **Format**: Individual JSON files for scalability (one file per bookmark)
- **Structure**: Organized in a `bookmarks/` directory within app data
- **ID Generation**: SHA-256 hash of URL, first 10 characters as unique ID
- **Master Index**: Single `index.json` file for fast searching/filtering

### Technology Stack

- **Framework**: Electron with React + TypeScript
- **Styling**: Tailwind CSS for modern UI
- **State Management**: React Context + useReducer
- **HTTP Client**: axios for URL fetching
- **HTML Parsing**: cheerio for metadata extraction
- **File Operations**: Node.js fs/promises for async file handling

### Security Considerations

- Content sanitization using DOMPurify
- URL validation and normalization
- Safe file path generation
- Request timeout and size limits
- User-agent string for respectful crawling

---

## Core Components

### 1. Main Process (Electron)

- **File System Manager**: Handle JSON read/write operations
- **IPC Handler**: Communication bridge with renderer
- **Settings Manager**: User preferences and configuration
- **Security Layer**: Content validation and sanitization

### 2. Renderer Process (React UI)

- **Main List View**: Virtual scrolling for performance with thousands of items
- **Add URL Dialog**: Batch input with validation and progress tracking
- **Edit Entry Dialog**: Full metadata editing capability
- **Tag Manager**: Autocomplete and tag organization
- **Search Interface**: Real-time filtering and search
- **Import/Export**: JSON file handling with merge options

### 3. Core Services

- **Metadata Extractor**: Robust web scraping with fallbacks
- **Bookmark Manager**: CRUD operations with duplicate detection
- **Tag Service**: Tag management and suggestions
- **Search Engine**: Fast local search across all fields
- **Storage Service**: File system abstraction

---

## Data Structures

### Bookmark Document

```json
{
  "id": "7e9d2804f1",
  "url": "https://issues.org/limits-of-data-nguyen/",
  "file_path": "private/bookmarks/limits-of-data-nguyen_7e9d2804.html",
  "absolute_path": "/Users/gideon/Documents/Obsidian/Zettelgarten/private/bookmarks/limits-of-data-nguyen_7e9d2804.html",
  "title": "The Limits of Data",
  "date_added": "2025-01-07T15:49:29.179379",
  "date_modified": "2025-01-07T15:49:29.179379",
  "tags": ["philosophy", "data-science"],
  "save_content": false,
  "metadata": {
    "extracted_title": "The Limits of Data",
    "meta_description": "Policymakers want to make decisions based on clear data...",
    "meta_keywords": null,
    "text_preview": "Search Issues Menu Subscribe About Us Events...",
    "meta_image": "https://issues.org/wp-content/uploads/2023/12/Datafinal3.jpeg",
    "open_graph": {
      "title": "The Limits of Data",
      "description": "...",
      "image": "...",
      "type": "article"
    },
    "twitter_card": {
      "title": "...",
      "description": "...",
      "image": "..."
    },
    "author": "Author Name",
    "publish_date": "2023-12-15",
    "word_count": 2847,
    "lang": "en"
  },
  "extraction_status": "success",
  "extraction_errors": []
}
```

### Master Index

```json
{
  "version": "1.0.0",
  "total_bookmarks": 1247,
  "last_updated": "2025-01-07T15:49:29.179379",
  "all_tags": ["philosophy", "tech", "research"],
  "bookmarks": [
    {
      "id": "7e9d2804f1",
      "url": "https://issues.org/limits-of-data-nguyen/",
      "title": "The Limits of Data",
      "tags": ["philosophy", "data-science"],
      "date_added": "2025-01-07T15:49:29.179379"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- [x] Project setup with Electron + React + TypeScript
- [ ] Basic file system operations
- [ ] ID generation and duplicate detection
- [ ] Simple bookmark CRUD operations
- [ ] Basic UI layout and navigation

### Phase 2: Metadata Extraction (Week 1-2)

- [ ] URL validation and normalization
- [ ] Web scraping with cheerio and axios
- [ ] Metadata extraction pipeline
- [ ] Error handling and fallbacks
- [ ] Content sanitization
- [ ] Progress tracking for batch operations

### Phase 3: User Interface (Week 2)

- [ ] Main bookmark list with virtual scrolling
- [ ] Add URL dialog with batch input
- [ ] Edit bookmark dialog
- [ ] Tag management interface
- [ ] Search and filter functionality
- [ ] Settings panel

### Phase 4: Advanced Features (Week 3)

- [ ] Import/export functionality
- [ ] Content saving option (toggle)
- [ ] Bulk operations
- [ ] Keyboard shortcuts
- [ ] Dark/light theme

### Phase 5: Polish & Testing (Week 3-4)

- [ ] Performance optimization
- [ ] Cross-platform testing
- [ ] Error handling refinement
- [ ] Documentation
- [ ] Packaging and distribution

---

## Technical Implementation Details

### Metadata Extraction Pipeline

1. **URL Validation**: Check format, protocol, and accessibility
2. **Content Fetching**: HTTP request with timeout and size limits
3. **HTML Parsing**: Extract title, meta tags, and Open Graph data
4. **Text Preview**: Generate clean preview text (300-500 characters)
5. **Image Processing**: Validate and store image URLs
6. **Content Sanitization**: Clean and validate all extracted data

### Batch Processing Strategy

- **Concurrency**: Process up to 5 URLs simultaneously
- **Progress Tracking**: Real-time updates with success/failure counts
- **Error Recovery**: Continue processing despite individual failures
- **Rate Limiting**: Respectful delays between requests
- **User Feedback**: Clear status indicators and error reporting

### Search Implementation

- **Indexed Fields**: URL, title, description, tags, and preview text
- **Search Types**: Full-text search and tag filtering
- **Performance**: In-memory index for fast searching
- **Real-time**: Live search as user types

### Security Measures

- **URL Sanitization**: Validate and normalize URLs
- **Content Limits**: Maximum file sizes and timeouts
- **XSS Prevention**: Sanitize all extracted content
- **Safe File Paths**: Prevent directory traversal attacks
- **Request Headers**: Appropriate user-agent strings

---

## File Structure

```
resource-manager/
├── package.json
├── electron.js                 # Main process
├── src/
│   ├── main/                   # Main process modules
│   │   ├── storage.ts
│   │   ├── metadata.ts
│   │   └── ipc-handlers.ts
│   ├── renderer/               # React UI
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── shared/                 # Shared types and utilities
│       ├── types.ts
│       └── utils.ts
├── public/
└── dist/                       # Build output
```

---

## Testing Strategy

### Unit Tests

- Metadata extraction functions
- URL validation and ID generation
- File system operations
- Search and filter logic

### Integration Tests

- End-to-end bookmark lifecycle
- Batch processing workflows
- Import/export functionality
- Error handling scenarios

### Performance Tests

- Large dataset handling (10,000+ bookmarks)
- Search performance benchmarks
- Memory usage optimization
- File system operation efficiency

---

## Performance Considerations

### Scalability Targets

- **Bookmark Capacity**: 10,000+ bookmarks without performance degradation
- **Search Speed**: Sub-100ms search results
- **Batch Processing**: 100+ URLs processed efficiently
- **Memory Usage**: <500MB for large datasets
- **Startup Time**: <3 seconds cold start

### Optimization Strategies

- Virtual scrolling for large lists
- Lazy loading of bookmark content
- Indexed searching with cached results
- Background processing for non-critical operations
- Efficient file system operations

---

## Future Enhancements (Post-MVP)

### Advanced Features

- Browser extension integration
- Custom metadata fields
- Advanced tagging (hierarchical tags)
- Full-text search within saved content
- Duplicate detection based on content similarity

### Integration Options

- Cloud storage sync (user's choice)
- Export to various formats (CSV, OPML, etc.)
- API for third-party integrations
- Plugin system for custom extractors

---

## Delivery Timeline

- **Week 1**: Core infrastructure and basic metadata extraction
- **Week 2**: Complete UI and advanced extraction features
- **Week 3**: Polish, testing, and packaging
- **Week 4**: Final testing and documentation

Total estimated development time: 3-4 weeks for MVP with all specified features.
