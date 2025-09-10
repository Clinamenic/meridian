# Specification: Local-First Electron App for URL Input and JSON Document Store

## Overview

This Electron desktop application enables users to input URLs (bookmarks/resources), automatically processes each URL to extract and store metadata, and manages all data in a local JSON document store. The app is designed for offline-first usage, with a modern, minimal UI for adding, tagging, and editing entries. Data is never sent to a remote server; all processing and storage are local.

---

## Key Requirements

- **Local-first:** All data and processing remain on the user’s device.
- **Cross-platform:** Runs on Windows, macOS, and Linux.
- **User input:** Users can add URLs via the UI (single or batch).
- **Metadata extraction:** On adding a URL, the app fetches and extracts metadata (title, description, preview text, favicon/image, etc.).
- **Tagging:** Users can add, edit, and remove tags for each URL.
- **Editing:** Users can edit any metadata field manually.
- **JSON document store:** All entries are stored as JSON documents, either as individual files or in a single JSON file.
- **Export:** Users can export the full dataset as a JSON file.
- **Import:** Users can import a JSON file to restore or merge data.
- **Search/filter:** Users can search and filter entries by URL, title, tags, and metadata.
- **Simple, responsive UI:** Built with a modern web framework (e.g., React + Tailwind CSS).

---

## User Interface Components

- **Main List View:** Displays all stored URLs with key metadata (title, URL, tags, date added).
- **Add URL Dialog:** Input field for new URLs (single or batch), with optional tags.
- **Edit Entry Dialog:** Allows editing all metadata fields and tags for a selected entry.
- **Tag Editor:** UI element for adding/removing tags (autocomplete for existing tags).
- **Search/Filter Bar:** For searching by URL, title, or tags.
- **Export/Import Controls:** Buttons or menu options for exporting/importing JSON.
- **Settings:** Minimal, e.g., choose storage location, theme.

---

## Data Structures

### Bookmark Document (JSON)

Each bookmark is represented as a JSON object:

{
"id": "unique-id-or-hash",
"url": "https://example.com",
"file_path": "local/path/to/saved/content.html",
"absolute_path": "/Users/username/Bookmarks/example.html",
"title": "Example Title",
"date_added": "2025-06-05T13:31:00Z",
"tags": ["tag1", "tag2"],
"metadata": {
"extracted_title": "Example Title",
"meta_description": "Short description...",
"meta_keywords": ["keyword1", "keyword2"],
"text_preview": "First few lines of content...",
"meta_image": "https://example.com/image.jpg"
}
}

text

### Storage

- Default: Single JSON file (`bookmarks.json`) containing an array of bookmark objects.
- Optional: Directory of individual JSON files (one per bookmark) for scalability.

---

## Components to Create

- **Electron Main Process**
  - Handles file system operations (read/write JSON, import/export).
  - Manages IPC communication with renderer.
- **Renderer Process (UI)**
  - Built with React (or framework of choice).
  - Implements all UI components above.
- **Metadata Extraction Module**
  - Fetches URL content.
  - Extracts title, meta description, preview, image, etc.
  - Handles errors gracefully (e.g., network issues, invalid URLs).
- **Tag Management Module**
  - Maintains list of all tags.
  - Supports tag autocomplete and filtering.
- **Search/Filter Module**
  - Provides fast, local search/filtering of bookmarks.
- **Import/Export Module**
  - Handles merging, deduplication, and backup/restore.

---

## User Experience Flow

1. **Add URL**

   - User clicks “Add URL,” enters one or more URLs, optionally adds tags.
   - App fetches each URL, extracts metadata, and creates bookmark document(s).
   - New entries appear in the main list.

2. **Edit Entry**

   - User clicks an entry to open the edit dialog.
   - All fields, including tags and metadata, are editable.
   - Changes are saved to local storage.

3. **Tagging**

   - Tags can be added/removed via a tag editor UI.
   - Tag suggestions/autocomplete from existing tags.

4. **Search/Filter**

   - User types in the search bar to filter bookmarks by title, URL, or tags.

5. **Export/Import**
   - User can export the entire collection as a JSON file.
   - User can import a JSON file to add/restore bookmarks.

---

## Implementation Plan

### 1. Project Setup

- Use [Electron Forge](https://www.electronforge.io/) or [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) for scaffolding.
- Set up React (or preferred framework) for the renderer process.
- Configure build scripts for dev and production.

### 2. Core Features

- **Bookmark CRUD:** Implement create, read, update, delete for bookmarks.
- **Metadata Extraction:** Use a Node.js library (e.g., [`node-fetch`](https://www.npmjs.com/package/node-fetch), [`cheerio`](https://cheerio.js.org/)) to fetch and parse web pages for metadata.
- **Tag Management:** Implement tag editor and autocomplete.
- **Search/Filter:** Implement local search/filter logic.
- **Import/Export:** File dialogs for importing/exporting JSON.

### 3. Data Persistence

- Use Node.js [`fs`](https://nodejs.org/api/fs.html) module for reading/writing JSON files.
- Consider using a lightweight local database (e.g., [lowdb](https://github.com/typicode/lowdb)) for abstraction, but ensure JSON export compatibility.

### 4. UI/UX

- Build responsive UI with [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/) (or similar).
- Ensure accessibility and keyboard navigation.

### 5. Packaging & Distribution

- Use [Electron Forge](https://www.electronforge.io/) or [Electron Builder](https://www.electron.build/) for packaging and cross-platform builds.
- Test on Windows, macOS, and Linux.

---

## Dependency Notes

- [Electron](https://www.electronjs.org/) (core framework)
- [React](https://react.dev/) (UI framework)
- [Tailwind CSS](https://tailwindcss.com/) (styling, optional)
- [node-fetch](https://www.npmjs.com/package/node-fetch) / [axios](https://axios-http.com/) (HTTP requests)
- [cheerio](https://cheerio.js.org/) (HTML parsing)
- [lowdb](https://github.com/typicode/lowdb) or direct file I/O (for JSON storage)
- [uuid](https://www.npmjs.com/package/uuid) (for unique IDs)
- [Electron Forge](https://www.electronforge.io/) / [Electron Builder](https://www.electron.build/) (packaging/distribution)

---

## Testing Requirements

- Unit tests for metadata extraction and data manipulation.
- Integration tests for UI workflows (add, edit, tag, search, import/export).
- Manual QA for cross-platform compatibility.

---

## Future Enhancements

- **Bulk operations:** Batch tagging, deleting, or editing.
- **Browser extension integration:** For direct bookmarking from browser.
- **Custom fields:** Allow users to define new metadata fields.
- **Theme customization:** Light/dark mode, color schemes.
- **Cloud sync (optional):** Opt-in encrypted sync to user’s cloud storage.

---

## References & Templates

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Forge](https://www.electronforge.io/)
- [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [Electron-React-Vite Template](https://github.com/cawa-93/vite-electron-builder)
- [Simple Electron Template](https://github.com/sindresorhus/electron-boilerplate)
- [Secure Electron Template](https://github.com/reZach/secure-electron-template)

---
