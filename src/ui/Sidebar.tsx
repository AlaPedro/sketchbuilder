import { useReactFlow } from '@xyflow/react';
import { Pencil, Plus, StickyNote, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { Template } from '../types';
import { SIDES } from '../types';

export function useViewCenter() {
  const rf = useReactFlow();
  return () => {
    const el = document.querySelector('.canvas')?.getBoundingClientRect();
    if (!el) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: el.left + el.width / 2, y: el.top + el.height / 2 });
  };
}

const pinCount = (t: Template) => SIDES.reduce((n, s) => n + t.pins[s].length, 0);

export function Sidebar() {
  const library = useAppStore((s) => s.library);
  const { addFromTemplate, addNote, deleteTemplate, set } = useAppStore.getState();
  const viewCenter = useViewCenter();

  return (
    <aside className="sidebar">
      <div className="brand">SketchMaker</div>

      <button className="primary-btn" onClick={() => set({ editor: { mode: 'new' } })}>
        <Plus size={16} /> Novo componente
      </button>
      <button className="ghost-btn" onClick={() => addNote(viewCenter())}>
        <StickyNote size={16} /> Texto
      </button>

      <div className="sb-title">Biblioteca</div>
      <div className="sb-hint">Clique ou arraste para o canvas</div>
      <ul className="lib">
        {library.map((t) => (
          <li
            key={t.id}
            className="lib-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/sketchmaker-template', t.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => addFromTemplate(t, viewCenter())}
          >
            <span className="lib-swatch" style={{ background: t.color }} />
            <span className="lib-name">{t.label}</span>
            <span className="lib-count">{pinCount(t)}p</span>
            <button
              className="icon-btn"
              title="Editar modelo"
              onClick={(e) => {
                e.stopPropagation();
                set({ editor: { mode: 'template', templateId: t.id } });
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              className="icon-btn"
              title="Remover da biblioteca"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Remover "${t.label}" da biblioteca?`)) deleteTemplate(t.id);
              }}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
