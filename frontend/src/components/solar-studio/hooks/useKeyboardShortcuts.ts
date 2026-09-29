// =============================================================================
// Keyboard Shortcuts Hook
// =============================================================================

import { useEffect, useRef } from 'react';
import { useDesignStore } from '../store/designStore';

export function useKeyboardShortcuts() {
  const store = useDesignStore();
  const keyBuffer = useRef('');
  const bufferTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't capture when typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            store.undo();
            return;
          case 'y':
            e.preventDefault();
            store.redo();
            return;
          case 'c':
            e.preventDefault();
            store.copySelected();
            return;
          case 'v':
            e.preventDefault();
            store.paste();
            return;
          case 's':
            e.preventDefault();
            store.saveDesign();
            return;
        }
      }

      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.deleteSelected();
          return;
        }
      }

      // I key → inverter menu
      if (e.key.toLowerCase() === 'i' && !e.ctrlKey) {
        store.setActiveTool('component_inverter');
        return;
      }

      // M key → mirror mode (after paste)
      if (e.key.toLowerCase() === 'm' && store.lastPasteOffset) {
        store.setPasteMode('mirror');
        return;
      }

      // R key → repeat mode (after paste)
      if (e.key.toLowerCase() === 'r' && store.lastPasteOffset && !e.ctrlKey) {
        store.setPasteMode('repeat');
        return;
      }

      // Escape → cancel drawing / deselect
      if (e.key === 'Escape') {
        store.clearDrawing();
        store.clearSelection();
        store.setActiveTool('select');
        return;
      }

      // Enter → close polygon
      if (e.key === 'Enter' && store.isDrawing) {
        // Signal to close polygon — handled by canvas
        window.dispatchEvent(new CustomEvent('studio:close-polygon'));
        return;
      }

      // Number sequences for view switching (22, 33, 44)
      clearTimeout(bufferTimer.current);
      keyBuffer.current += e.key;
      bufferTimer.current = setTimeout(() => { keyBuffer.current = ''; }, 500);

      if (keyBuffer.current === '22') {
        store.setViewMode('2d');
        keyBuffer.current = '';
        return;
      }
      if (keyBuffer.current === '33') {
        store.setViewMode('3d');
        keyBuffer.current = '';
        return;
      }
      if (keyBuffer.current === '44') {
        store.setViewMode('sld');
        keyBuffer.current = '';
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);
}
