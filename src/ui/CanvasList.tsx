import { useReactFlow } from '@xyflow/react';
import { Copy, Plus, Search, Trash2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CANVAS_COLORS, useAppStore } from '../store';
import type { AppNode, CanvasDoc, WireEdgeT } from '../types';

/** Ações de canvas que guardam/restauram o enquadramento (zoom e posição) de cada um. */
export function useCanvasNav() {
  const rf = useReactFlow();
  const restore = () =>
    setTimeout(() => {
      const st = useAppStore.getState();
      const doc = st.canvases.find((c) => c.id === st.activeId);
      if (doc?.viewport) rf.setViewport(doc.viewport);
      else if (st.nodes.length) rf.fitView({ padding: 0.2, maxZoom: 1.2 });
      else rf.setViewport({ x: 0, y: 0, zoom: 1 });
    }, 30);
  const st = useAppStore.getState;
  return {
    open: (id: string) => {
      if (id === st().activeId) return;
      st().switchCanvas(id, rf.getViewport());
      restore();
    },
    create: (opts: { name?: string; nodes?: AppNode[]; edges?: WireEdgeT[] } = {}) => {
      const id = st().createCanvas({ ...opts, viewport: rf.getViewport() });
      restore();
      return id;
    },
    duplicate: (id: string) => {
      st().duplicateCanvas(id, rf.getViewport());
      restore();
    },
    remove: (id: string) => {
      const wasActive = id === st().activeId;
      st().deleteCanvas(id);
      if (wasActive) restore();
    },
  };
}

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : d < 30 ? `há ${d} dias` : new Date(t).toLocaleDateString('pt-BR');
};

/** Miniatura do desenho: retângulos dos componentes/notas e linhas dos fios. */
const Thumb = memo(function Thumb({ nodes, edges }: { nodes: AppNode[]; edges: WireEdgeT[] }) {
  const W = 46;
  const H = 32;
  const box = (n: AppNode) => {
    const w = n.width ?? n.measured?.width ?? (n.type === 'point' ? 20 : 120);
    const h = n.height ?? n.measured?.height ?? (n.type === 'point' ? 20 : 80);
    return { x: n.position.x, y: n.position.y, w, h };
  };
  const boxes = new Map(nodes.map((n) => [n.id, box(n)]));
  const vis = nodes.filter((n) => n.type !== 'point');
  if (!vis.length) return <svg className="cv-thumb empty" viewBox={`0 0 ${W} ${H}`} />;
  const all = [...boxes.values()];
  const minX = Math.min(...all.map((b) => b.x));
  const minY = Math.min(...all.map((b) => b.y));
  const maxX = Math.max(...all.map((b) => b.x + b.w));
  const maxY = Math.max(...all.map((b) => b.y + b.h));
  const pad = 3;
  const k = Math.min((W - pad * 2) / Math.max(maxX - minX, 1), (H - pad * 2) / Math.max(maxY - minY, 1));
  const ox = (W - (maxX - minX) * k) / 2;
  const oy = (H - (maxY - minY) * k) / 2;
  const X = (x: number) => ox + (x - minX) * k;
  const Y = (y: number) => oy + (y - minY) * k;
  const center = (id: string) => {
    const b = boxes.get(id);
    return b ? { x: X(b.x + b.w / 2), y: Y(b.y + b.h / 2) } : null;
  };
  return (
    <svg className="cv-thumb" viewBox={`0 0 ${W} ${H}`}>
      {edges.map((e) => {
        const a = center(e.source);
        const b = center(e.target);
        return a && b ? (
          <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.data?.color ?? '#1e1e1e'} strokeWidth={0.7} />
        ) : null;
      })}
      {vis.map((n) => {
        const b = boxes.get(n.id)!;
        const fill = n.type === 'note' ? '#fff3a3' : n.type === 'component' ? n.data.color : '#fff';
        return (
          <rect key={n.id} x={X(b.x)} y={Y(b.y)} width={Math.max(b.w * k, 1.5)} height={Math.max(b.h * k, 1.5)}
            rx={0.8} fill={fill} stroke="#1e1e1e" strokeWidth={0.5} />
        );
      })}
    </svg>
  );
});

function CanvasItem({ doc, active, index }: { doc: CanvasDoc; active: boolean; index: number }) {
  const nav = useCanvasNav();
  const live = useAppStore(useShallow((s) => (active ? { nodes: s.nodes, edges: s.edges } : { nodes: doc.nodes, edges: doc.edges })));
  const { renameCanvas, recolorCanvas, moveCanvas } = useAppStore.getState();
  const [editing, setEditing] = useState(false);
  const [dropAt, setDropAt] = useState<'before' | 'after' | null>(null);
  const comps = live.nodes.filter((n) => n.type === 'component').length;

  const nextColor = () => {
    const i = CANVAS_COLORS.indexOf(doc.color);
    recolorCanvas(doc.id, CANVAS_COLORS[(i + 1) % CANVAS_COLORS.length]);
  };

  return (
    <li
      className={`cv-item${active ? ' active' : ''}${dropAt ? ` drop-${dropAt}` : ''}`}
      style={{ ['--cv' as string]: doc.color }}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/sketchmaker-canvas', doc.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/sketchmaker-canvas')) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setDropAt(e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      }}
      onDragLeave={() => setDropAt(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('application/sketchmaker-canvas');
        const list = useAppStore.getState().canvases;
        const from = list.findIndex((c) => c.id === id);
        let to = index + (dropAt === 'after' ? 1 : 0);
        if (from < to) to--;
        setDropAt(null);
        if (id && id !== doc.id) moveCanvas(id, to);
      }}
      onClick={() => !editing && nav.open(doc.id)}
      title={editing ? undefined : 'Clique para abrir · duplo clique no nome para renomear · arraste para reordenar'}
    >
      <button
        className="cv-color"
        title="Trocar cor"
        onClick={(e) => {
          e.stopPropagation();
          nextColor();
        }}
      />
      <Thumb nodes={live.nodes} edges={live.edges} />
      <div className="cv-text">
        {editing ? (
          <input
            className="cv-rename"
            autoFocus
            defaultValue={doc.name}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              renameCanvas(doc.id, e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="cv-name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {doc.name}
          </span>
        )}
        <span className="cv-meta">
          {comps} comp. · {ago(doc.updatedAt)}
        </span>
      </div>
      <div className="cv-actions">
        <button
          className="icon-btn"
          title="Duplicar canvas"
          onClick={(e) => {
            e.stopPropagation();
            nav.duplicate(doc.id);
          }}
        >
          <Copy size={13} />
        </button>
        <button
          className="icon-btn"
          title="Apagar canvas"
          onClick={(e) => {
            e.stopPropagation();
            if (!live.nodes.length || confirm(`Apagar o canvas "${doc.name}" e tudo que está nele?`)) nav.remove(doc.id);
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

export function CanvasList() {
  const nav = useCanvasNav();
  // Só o que muda a lista (não os nós do canvas ativo, que cada item lê sozinho).
  const docs = useAppStore(useShallow((s) => s.canvases));
  const activeId = useAppStore((s) => s.activeId);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Alt+N: novo canvas · Alt+↑/↓: canvas anterior/próximo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable=true]')) return;
      const st = useAppStore.getState();
      if (st.editor || st.pasteOpen) return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nav.create();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const i = st.canvases.findIndex((c) => c.id === st.activeId);
        const next = st.canvases[(i + (e.key === 'ArrowUp' ? -1 : 1) + st.canvases.length) % st.canvases.length];
        nav.open(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shown = docs.map((d, i) => ({ d, i })).filter(({ d }) => !q || d.name.toLowerCase().includes(q));

  return (
    <div className="cv-section">
      <div className="sb-title cv-head">
        <span>Canvas · {docs.length}</span>
        <button className="icon-btn cv-add" title="Novo canvas (Alt+N)" onClick={() => nav.create()}>
          <Plus size={15} />
        </button>
      </div>
      {docs.length > 5 && (
        <label className="cv-search">
          <Search size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canvas…" />
        </label>
      )}
      <ul className="cv-list">
        {shown.map(({ d, i }) => (
          <CanvasItem key={d.id} doc={d} index={i} active={d.id === activeId} />
        ))}
        {!shown.length && <li className="cv-none">Nenhum canvas com “{query}”</li>}
      </ul>
    </div>
  );
}

/** Nome do canvas ativo no canto da área de desenho (clique para renomear). */
export function CanvasTitle() {
  const doc = useAppStore(useShallow((s) => {
    const d = s.canvases.find((c) => c.id === s.activeId);
    return { id: d?.id ?? '', name: d?.name ?? '', color: d?.color ?? CANVAS_COLORS[0] };
  }));
  const [editing, setEditing] = useState(false);
  return (
    <div className="canvas-title" style={{ ['--cv' as string]: doc.color }}>
      {editing ? (
        <input
          className="cv-rename"
          autoFocus
          defaultValue={doc.name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            useAppStore.getState().renameCanvas(doc.id, e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button className="canvas-title-name" title="Renomear canvas" onClick={() => setEditing(true)}>
          {doc.name}
        </button>
      )}
    </div>
  );
}
