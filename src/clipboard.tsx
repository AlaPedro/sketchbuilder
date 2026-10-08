import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { useAppStore } from './store';
import type { AppNode, WireEdgeT } from './types';

/**
 * Ctrl+C / Ctrl+X / Ctrl+V de itens do canvas. O conteúdo vai para a área de transferência
 * do sistema (texto JSON), então dá para colar em outro canvas, em outra aba ou depois de recarregar.
 */
interface ClipPayload {
  app: 'sketchmaker';
  kind: 'clip';
  version: 1;
  nodes: AppNode[];
  edges: WireEdgeT[];
}

const isClip = (d: unknown): d is ClipPayload =>
  !!d && typeof d === 'object' && (d as ClipPayload).app === 'sketchmaker' && (d as ClipPayload).kind === 'clip' &&
  Array.isArray((d as ClipPayload).nodes) && Array.isArray((d as ClipPayload).edges);

/** Itens selecionados + fios cujas duas pontas estão na seleção. */
function selection(): ClipPayload | null {
  const { nodes, edges } = useAppStore.getState();
  const sel = nodes.filter((n) => n.selected);
  if (!sel.length) return null;
  const ids = new Set(sel.map((n) => n.id));
  const strip = <T extends { selected?: boolean; dragging?: boolean }>(x: T) => {
    const { selected: _s, dragging: _d, ...rest } = x;
    return rest as T;
  };
  return {
    app: 'sketchmaker',
    kind: 'clip',
    version: 1,
    nodes: sel.map(strip),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map(strip),
  };
}

const count = (p: ClipPayload) => {
  const n = p.nodes.filter((x) => x.type !== 'point').length;
  return `${n} ${n === 1 ? 'item' : 'itens'}${p.edges.length ? ` e ${p.edges.length} fio(s)` : ''}`;
};

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable=true]');

export function useCanvasClipboard() {
  const rf = useReactFlow<AppNode, WireEdgeT>();

  useEffect(() => {
    // Onde colar: no cursor, se ele estiver sobre o canvas; senão no centro da tela.
    let mouse: { x: number; y: number } | null = null;
    let lastPaste: { x: number; y: number; n: number } | null = null;
    const onMove = (e: MouseEvent) => {
      mouse = (e.target as HTMLElement).closest?.('.canvas') ? { x: e.clientX, y: e.clientY } : null;
    };

    const target = () => {
      const el = document.querySelector('.canvas')?.getBoundingClientRect();
      const screen = mouse ?? (el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : { x: 0, y: 0 });
      // Colar de novo no mesmo lugar empilha em degraus, em vez de sobrepor.
      const same = lastPaste && lastPaste.x === screen.x && lastPaste.y === screen.y;
      lastPaste = { ...screen, n: same ? lastPaste!.n + 1 : 0 };
      const at = rf.screenToFlowPosition(screen);
      return { x: at.x + lastPaste.n * 30, y: at.y + lastPaste.n * 30 };
    };

    const blocked = (e: Event) => {
      const st = useAppStore.getState();
      return typing(e.target) || !!window.getSelection()?.toString() || !!st.editor || st.pasteOpen;
    };

    const onCopy = (e: ClipboardEvent, cut = false) => {
      if (blocked(e)) return;
      const clip = selection();
      if (!clip || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', JSON.stringify(clip));
      const st = useAppStore.getState();
      if (cut) {
        rf.deleteElements({ nodes: clip.nodes.map((n) => ({ id: n.id })), edges: clip.edges.map((x) => ({ id: x.id })) });
        st.showToast(`Recortado: ${count(clip)}`);
      } else st.showToast(`Copiado: ${count(clip)} — cole com Ctrl+V aqui ou em outro canvas`);
    };
    const onCut = (e: ClipboardEvent) => onCopy(e, true);

    const onPaste = (e: ClipboardEvent) => {
      if (blocked(e)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      if (!isClip(data)) return;
      e.preventDefault();
      const st = useAppStore.getState();
      st.pasteItems(data.nodes, data.edges, target());
      st.showToast(`Colado: ${count(data)}`);
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [rf]);
}

export function Toast() {
  const msg = useAppStore((s) => s.toast);
  return msg ? <div className="toast">{msg}</div> : null;
}
