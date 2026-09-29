import { useReactFlow } from '@xyflow/react';
import { Check, ClipboardPaste, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { buildAiPrompt } from '../aiPrompt';
import { toSimple } from '../simple';
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export function Sidebar() {
  const library = useAppStore((s) => s.library);
  const { addFromTemplate, deleteTemplate, set } = useAppStore.getState();
  const viewCenter = useViewCenter();
  const [copied, setCopied] = useState(false);

  const copyForAi = async () => {
    const { nodes, edges, library: lib } = useAppStore.getState();
    await copyText(buildAiPrompt(toSimple(nodes, edges, lib), lib));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <aside className="sidebar">
      <h1 className="brand">SketchMaker</h1>

      <button className="primary-btn" onClick={() => set({ editor: { mode: 'new' } })}>
        <Plus size={16} /> Novo componente
      </button>

      <div className="sb-title">IA</div>
      <button className="ai-btn" onClick={copyForAi}>
        {copied ? <Check size={16} /> : <Sparkles size={16} />}
        {copied ? 'Copiado! Cole no chat' : 'Copiar para IA'}
      </button>
      <button className="ghost-btn" onClick={() => set({ pasteOpen: true })}>
        <ClipboardPaste size={16} /> Colar resposta da IA
      </button>
      <div className="sb-hint sb-hint-block">
        Copia instruções, biblioteca e o circuito atual. No chat, escreva seu pedido no final.
      </div>

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
