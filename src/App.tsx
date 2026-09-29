import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from './Canvas';
import { useAppStore } from './store';
import { ComponentEditor } from './ui/ComponentEditor';
import { Inspector } from './ui/Inspector';
import { Sidebar } from './ui/Sidebar';
import { Toolbar } from './ui/Toolbar';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable=true]')) return;
      const st = useAppStore.getState();
      if (st.editor) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) return e.preventDefault(), st.undo();
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return e.preventDefault(), st.redo();
      if (mod && k === 'd') return e.preventDefault(), st.duplicateSelected();
      if (mod || e.altKey) return;
      if (k === 'v') st.set({ tool: 'select' });
      else if (k === 'j') st.set({ tool: 'join' });
      else if (k === 'c') st.set({ tool: 'cut' });
      else if (k === 'r') st.rotateSelected();
      else if (k === 'escape') st.set({ tool: 'select' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  useShortcuts();
  return (
    <ReactFlowProvider>
      <div className="app">
        <Sidebar />
        <main className="stage">
          <Canvas />
          <Toolbar />
          <Inspector />
        </main>
        <ComponentEditor />
      </div>
    </ReactFlowProvider>
  );
}
