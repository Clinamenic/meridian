import React from 'react';
import { createRoot } from 'react-dom/client';
import { BookmarkManager } from './components/BookmarkManager';

const App: React.FC = () => {
  return (
    <div className="app">
      <BookmarkManager />
    </div>
  );
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root container not found');
} 