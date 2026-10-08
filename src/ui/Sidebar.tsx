import { useReactFlow } from '@xyflow/react';
import { Check, ClipboardPaste, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { buildAiPrompt } from '../aiPrompt';
import { toSimple } from '../simple';
import { useAppStore } from '../store';
import type { Template } from '../types';
import { SIDES } from '../types';
import { CanvasList } from './CanvasList';

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

/** Componentes e notas selecionados (pontos de fio não contam). */
export const useSelectedItemCount = () =>
  useAppStore((s) => s.nodes.filter((n) => n.selected && n.type !== 'point').length);

/**
 * Copia o prompt para IA. `selection`: só os componentes/notas selecionados e os fios entre eles
 * (os pontos entram todos para que fios com dobras/junções entre itens selecionados não se percam).
 */
export function useCopyForAi() {
  const [copied, setCopied] = useState<'all' | 'selection' | null>(null);
  const copy = async (scope: 'all' | 'selection') => {
    const { nodes, edges, library } = useAppStore.getState();
    const part = scope === 'selection' ? nodes.filter((n) => n.type === 'point' || n.selected) : nodes;
    await copyText(buildAiPrompt(toSimple(part, edges, library), library, scope === 'selection'));
    setCopied(scope);
    setTimeout(() => setCopied(null), 2500);
  };
  return { copy, copied };
}

export function Sidebar() {
  const library = useAppStore((s) => s.library);
  const { addFromTemplate, deleteTemplate, set } = useAppStore.getState();
  const viewCenter = useViewCenter();
  const { copy, copied } = useCopyForAi();
  const selCount = useSelectedItemCount();

  return (
    <aside className="sidebar">
      <h1 className="brand">SketchMaker</h1>

      <CanvasList />

      <button className="primary-btn" onClick={() => set({ editor: { mode: 'new' } })}>
        <Plus size={16} /> Novo componente
      </button>

      <div className="sb-title">IA</div>
      {selCount > 0 ? (
        <>
          <button className="ai-btn" onClick={() => copy('selection')}>
            {copied === 'selection' ? <Check size={16} /> : <Sparkles size={16} />}
            {copied === 'selection' ? 'Copiado! Cole no chat' : `Copiar seleção para IA (${selCount})`}
          </button>
          <button className="ghost-btn" onClick={() => copy('all')}>
            {copied === 'all' ? <Check size={16} /> : <Sparkles size={16} />}
            {copied === 'all' ? 'Copiado! Cole no chat' : 'Copiar projeto inteiro'}
          </button>
        </>
      ) : (
        <button className="ai-btn" onClick={() => copy('all')}>
          {copied === 'all' ? <Check size={16} /> : <Sparkles size={16} />}
          {copied === 'all' ? 'Copiado! Cole no chat' : 'Copiar para IA'}
        </button>
      )}
      <button className="ghost-btn" onClick={() => set({ pasteOpen: true })}>
        <ClipboardPaste size={16} /> Colar resposta da IA
      </button>
      <div className="sb-hint sb-hint-block">
        {selCount > 0
          ? 'Copia instruções, biblioteca e só os itens selecionados (com os fios entre eles).'
          : 'Copia instruções, biblioteca e o circuito atual. Selecione itens para copiar só uma parte.'}{' '}
        No chat, escreva seu pedido no final.
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
