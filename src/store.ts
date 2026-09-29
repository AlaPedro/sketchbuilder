import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILTIN_TEMPLATES } from './templates';
import type {
  AppNode,
  ComponentNodeT,
  EditorState,
  PinMap,
  PointNodeT,
  Template,
  Tool,
  WireEdgeT,
  WireStyle,
} from './types';
import {
  POINT_HANDLE,
  POINT_SIZE,
  autoSize,
  pinNames,
  rotatePinsCW,
  templateToPins,
  uid,
} from './utils';

interface Snapshot {
  nodes: AppNode[];
  edges: WireEdgeT[];
}

export interface ProjectFile {
  app: 'sketchmaker';
  version: 1;
  nodes: AppNode[];
  edges: WireEdgeT[];
  library?: Template[];
}

interface AppState {
  nodes: AppNode[];
  edges: WireEdgeT[];
  library: Template[];
  tool: Tool;
  wireColor: string;
  wireStyle: WireStyle;
  snap: boolean;
  editor: EditorState;
  pasteOpen: boolean;
  net: Set<string>;
  past: Snapshot[];
  future: Snapshot[];

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WireEdgeT>[]) => void;
  set: (partial: Partial<AppState>) => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  connect: (c: Connection) => void;
  addDanglingWire: (nodeId: string, handleId: string | null, pos: XYPosition) => void;
  reconnect: (edgeId: string, c: Connection) => void;
  detachEnd: (edgeId: string, end: 'source' | 'target', pos: XYPosition) => void;
  splitEdge: (edgeId: string, pos: XYPosition) => void;
  cutEdge: (edgeId: string, pos: XYPosition, dir: XYPosition) => void;
  mergePoint: (pointId: string, nodeId: string, handleId: string | null) => void;
  afterDelete: (deletedNodes: AppNode[], deletedEdges: WireEdgeT[]) => void;
  recolorSelected: (color: string) => void;

  addFromTemplate: (t: Template, center: XYPosition) => void;
  addComponent: (data: { label: string; color: string; pins: PinMap; width: number; height: number }, center: XYPosition) => void;
  updateComponent: (nodeId: string, data: { label: string; color: string; pins: PinMap; width: number; height: number }) => void;
  patchComponent: (nodeId: string, data: Partial<{ label: string; color: string }>) => void;
  rotateSelected: () => void;
  duplicateSelected: () => void;
  addNote: (center: XYPosition) => void;
  updateNote: (nodeId: string, text: string) => void;

  saveTemplate: (t: Template) => void;
  saveNodeAsTemplate: (nodeId: string) => void;
  deleteTemplate: (id: string) => void;

  loadProject: (p: ProjectFile) => void;
  importCircuit: (nodes: AppNode[], edges: WireEdgeT[], mode: 'replace' | 'add') => void;
  clearCanvas: () => void;
}

const HISTORY_LIMIT = 100;

const newWire = (
  source: string,
  sourceHandle: string | null | undefined,
  target: string,
  targetHandle: string | null | undefined,
  color: string,
): WireEdgeT => ({
  id: uid('w_'),
  type: 'wire',
  source,
  sourceHandle: sourceHandle ?? null,
  target,
  targetHandle: targetHandle ?? null,
  data: { color },
});

const newPoint = (center: XYPosition): PointNodeT => ({
  id: uid('pt_'),
  type: 'point',
  position: { x: center.x - POINT_SIZE / 2, y: center.y - POINT_SIZE / 2 },
  data: {},
  zIndex: 10,
});

const sameEnds = (a: WireEdgeT, b: WireEdgeT) => {
  const ka = `${a.source}:${a.sourceHandle}`;
  const kb = `${a.target}:${a.targetHandle}`;
  const kc = `${b.source}:${b.sourceHandle}`;
  const kd = `${b.target}:${b.targetHandle}`;
  return (ka === kc && kb === kd) || (ka === kd && kb === kc);
};

// Migra o salvamento automático do nome antigo (SketchBuilder) para o novo.
const STORAGE_KEY = 'sketchmaker-v1';
try {
  const legacy = localStorage.getItem('sketchbuilder-v1');
  if (legacy && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, legacy);
  localStorage.removeItem('sketchbuilder-v1');
} catch {
  // localStorage indisponível: segue sem migrar
}

const isLoop = (e: WireEdgeT) => e.source === e.target && e.sourceHandle === e.targetHandle;

function dedupe(edges: WireEdgeT[]): WireEdgeT[] {
  const out: WireEdgeT[] = [];
  for (const e of edges) {
    if (isLoop(e)) continue;
    if (out.some((o) => sameEnds(o, e))) continue;
    out.push(e);
  }
  return out;
}

/** Remove pontos que ficaram sem nenhum fio. */
function dropOrphanPoints(nodes: AppNode[], edges: WireEdgeT[]): AppNode[] {
  return nodes.filter(
    (n) => n.type !== 'point' || edges.some((e) => e.source === n.id || e.target === n.id),
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      library: BUILTIN_TEMPLATES,
      tool: 'select',
      wireColor: '#e03131',
      wireStyle: 'curvy',
      snap: true,
      editor: null,
      pasteOpen: false,
      net: new Set(),
      past: [],
      future: [],

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      set: (partial) => set(partial),

      commit: () => {
        const { nodes, edges, past } = get();
        set({ past: [...past.slice(-HISTORY_LIMIT + 1), { nodes, edges }], future: [] });
      },
      undo: () => {
        const { past, future, nodes, edges } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        set({ ...prev, past: past.slice(0, -1), future: [{ nodes, edges }, ...future] });
      },
      redo: () => {
        const { past, future, nodes, edges } = get();
        const next = future[0];
        if (!next) return;
        set({ ...next, past: [...past, { nodes, edges }], future: future.slice(1) });
      },

      connect: (c) => {
        const { edges, wireColor, commit } = get();
        const wire = newWire(c.source, c.sourceHandle, c.target, c.targetHandle, wireColor);
        if (isLoop(wire) || edges.some((e) => sameEnds(e, wire))) return;
        commit();
        set({ edges: [...get().edges, wire] });
      },

      addDanglingWire: (nodeId, handleId, pos) => {
        get().commit();
        const p = newPoint(pos);
        set({
          nodes: [...get().nodes, p],
          edges: [...get().edges, newWire(nodeId, handleId, p.id, POINT_HANDLE, get().wireColor)],
        });
      },

      reconnect: (edgeId, c) => {
        get().commit();
        const edges = get().edges.map((e) =>
          e.id === edgeId
            ? { ...e, source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle }
            : e,
        );
        const cleaned = dedupe(edges);
        set({ edges: cleaned, nodes: dropOrphanPoints(get().nodes, cleaned) });
      },

      detachEnd: (edgeId, end, pos) => {
        get().commit();
        const p = newPoint(pos);
        const edges = get().edges.map((e) =>
          e.id !== edgeId
            ? e
            : end === 'source'
              ? { ...e, source: p.id, sourceHandle: POINT_HANDLE }
              : { ...e, target: p.id, targetHandle: POINT_HANDLE },
        );
        set({ nodes: dropOrphanPoints([...get().nodes, p], edges), edges });
      },

      splitEdge: (edgeId, pos) => {
        const edge = get().edges.find((e) => e.id === edgeId);
        if (!edge) return;
        get().commit();
        const p = newPoint(pos);
        const color = edge.data?.color ?? get().wireColor;
        const a = newWire(edge.source, edge.sourceHandle, p.id, POINT_HANDLE, color);
        const b = newWire(p.id, POINT_HANDLE, edge.target, edge.targetHandle, color);
        set({
          nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), { ...p, selected: true }],
          edges: [...get().edges.filter((e) => e.id !== edgeId), a, b],
        });
      },

      cutEdge: (edgeId, pos, dir) => {
        const edge = get().edges.find((e) => e.id === edgeId);
        if (!edge) return;
        get().commit();
        const GAP = 14;
        const p1 = newPoint({ x: pos.x - dir.x * GAP, y: pos.y - dir.y * GAP });
        const p2 = newPoint({ x: pos.x + dir.x * GAP, y: pos.y + dir.y * GAP });
        const color = edge.data?.color ?? get().wireColor;
        const a = newWire(edge.source, edge.sourceHandle, p1.id, POINT_HANDLE, color);
        const b = newWire(p2.id, POINT_HANDLE, edge.target, edge.targetHandle, color);
        set({
          nodes: [...get().nodes, p1, p2],
          edges: [...get().edges.filter((e) => e.id !== edgeId), a, b],
        });
      },

      mergePoint: (pointId, nodeId, handleId) => {
        const edges = dedupe(
          get().edges.map((e) => {
            let n = e;
            if (n.source === pointId) n = { ...n, source: nodeId, sourceHandle: handleId };
            if (n.target === pointId) n = { ...n, target: nodeId, targetHandle: handleId };
            return n;
          }),
        );
        const nodes = dropOrphanPoints(
          get().nodes.filter((n) => n.id !== pointId),
          edges,
        );
        set({ nodes, edges });
      },

      afterDelete: (deletedNodes, deletedEdges) => {
        const deletedIds = new Set(deletedNodes.map((n) => n.id));
        const extra: WireEdgeT[] = [];
        // Apagar uma dobra (ponto com 2 fios) emenda os dois fios em vez de deixá-los soltos.
        for (const n of deletedNodes) {
          if (n.type !== 'point') continue;
          const attached = deletedEdges.filter((e) => e.source === n.id || e.target === n.id);
          if (attached.length !== 2) continue;
          const ends = attached.map((e) =>
            e.source === n.id ? { node: e.target, handle: e.targetHandle } : { node: e.source, handle: e.sourceHandle },
          );
          if (ends.some((end) => deletedIds.has(end.node))) continue;
          extra.push(newWire(ends[0].node, ends[0].handle, ends[1].node, ends[1].handle, attached[0].data?.color ?? get().wireColor));
        }
        const edges = dedupe([...get().edges, ...extra]);
        set({ edges, nodes: dropOrphanPoints(get().nodes, edges) });
      },

      recolorSelected: (color) => {
        const { edges, commit } = get();
        set({ wireColor: color });
        if (!edges.some((e) => e.selected)) return;
        commit();
        set({ edges: get().edges.map((e) => (e.selected ? { ...e, data: { ...e.data, color } } : e)) });
      },

      addFromTemplate: (t, center) => {
        const pins = templateToPins(t);
        const size = t.width && t.height ? { width: t.width, height: t.height } : autoSize(t.pins, t.label);
        get().addComponent({ label: t.label, color: t.color, pins, ...size }, center);
      },

      addComponent: (data, center) => {
        get().commit();
        const node: ComponentNodeT = {
          id: uid('c_'),
          type: 'component',
          position: { x: Math.round((center.x - data.width / 2) / 10) * 10, y: Math.round((center.y - data.height / 2) / 10) * 10 },
          width: data.width,
          height: data.height,
          data: { label: data.label, color: data.color, pins: data.pins },
          selected: true,
        };
        set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), node] });
      },

      updateComponent: (nodeId, data) => {
        get().commit();
        const nodes = get().nodes.map((n) =>
          n.id === nodeId && n.type === 'component'
            ? { ...n, width: data.width, height: data.height, data: { ...n.data, label: data.label, color: data.color, pins: data.pins } }
            : n,
        );
        // Fios ligados a pinos que foram removidos são apagados.
        const valid = new Set(
          [...data.pins.top, ...data.pins.right, ...data.pins.bottom, ...data.pins.left].map((p) => p.id),
        );
        const edges = get().edges.filter(
          (e) =>
            !(e.source === nodeId && !valid.has(e.sourceHandle ?? '')) &&
            !(e.target === nodeId && !valid.has(e.targetHandle ?? '')),
        );
        set({ nodes: dropOrphanPoints(nodes, edges), edges });
      },

      patchComponent: (nodeId, data) => {
        get().commit();
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId && n.type === 'component' ? { ...n, data: { ...n.data, ...data } } : n,
          ),
        });
      },

      rotateSelected: () => {
        const targets = get().nodes.filter((n) => n.selected && n.type === 'component');
        if (!targets.length) return;
        get().commit();
        set({
          nodes: get().nodes.map((n) => {
            if (!n.selected || n.type !== 'component') return n;
            const w = n.width ?? n.measured?.width ?? 100;
            const h = n.height ?? n.measured?.height ?? 60;
            const pins = rotatePinsCW(n.data.pins);
            const min = autoSize(pins, n.data.label);
            const nw = Math.max(h, min.width);
            const nh = Math.max(w, min.height);
            return {
              ...n,
              width: nw,
              height: nh,
              position: { x: n.position.x + (w - nw) / 2, y: n.position.y + (h - nh) / 2 },
              data: { ...n.data, pins },
            };
          }),
        });
      },

      duplicateSelected: () => {
        const { nodes, edges } = get();
        const sel = nodes.filter((n) => n.selected);
        if (!sel.length) return;
        get().commit();
        const map = new Map<string, string>();
        const OFFSET = 40;
        const clones = sel.map((n) => {
          const id = uid(n.type === 'point' ? 'pt_' : n.type === 'note' ? 'n_' : 'c_');
          map.set(n.id, id);
          return {
            ...structuredClone(n),
            id,
            position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
            selected: true,
          } as AppNode;
        });
        const edgeClones = edges
          .filter((e) => map.has(e.source) && map.has(e.target))
          .map((e) => ({ ...e, id: uid('w_'), source: map.get(e.source)!, target: map.get(e.target)!, selected: false }));
        set({
          nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...clones],
          edges: [...edges.map((e) => ({ ...e, selected: false })), ...edgeClones],
        });
      },

      addNote: (center) => {
        get().commit();
        set({
          nodes: [
            ...get().nodes.map((n) => ({ ...n, selected: false })),
            { id: uid('n_'), type: 'note', position: center, data: { text: 'Texto' }, selected: true },
          ],
        });
      },

      updateNote: (nodeId, text) => {
        get().commit();
        set({
          nodes: get().nodes.map((n) => (n.id === nodeId && n.type === 'note' ? { ...n, data: { text } } : n)),
        });
      },

      saveTemplate: (t) => {
        const lib = get().library;
        set({ library: lib.some((x) => x.id === t.id) ? lib.map((x) => (x.id === t.id ? t : x)) : [...lib, t] });
      },

      saveNodeAsTemplate: (nodeId) => {
        const n = get().nodes.find((x) => x.id === nodeId);
        if (!n || n.type !== 'component') return;
        get().saveTemplate({
          id: uid('tpl_'),
          label: n.data.label,
          color: n.data.color,
          pins: pinNames(n.data.pins),
          width: n.width ?? n.measured?.width,
          height: n.height ?? n.measured?.height,
        });
      },

      deleteTemplate: (id) => set({ library: get().library.filter((t) => t.id !== id) }),

      loadProject: (p) => {
        get().commit();
        const lib = [...get().library];
        for (const t of p.library ?? []) if (!lib.some((x) => x.id === t.id)) lib.push(t);
        set({ nodes: p.nodes, edges: p.edges, library: lib });
      },

      importCircuit: (nodes, edges, mode) => {
        get().commit();
        if (mode === 'replace') return set({ nodes, edges });
        // Adicionar: desloca o circuito novo para a direita do que já existe.
        const current = get().nodes;
        const right = (n: AppNode) => n.position.x + (n.width ?? n.measured?.width ?? 0);
        const dx = current.length ? Math.max(...current.map(right)) + 160 - Math.min(...nodes.map((n) => n.position.x)) : 0;
        const dy = current.length ? Math.min(...current.map((n) => n.position.y)) - Math.min(...nodes.map((n) => n.position.y)) : 0;
        const moved = nodes.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy }, selected: true }));
        set({
          nodes: [...current.map((n) => ({ ...n, selected: false })), ...moved],
          edges: [...get().edges, ...edges],
        });
      },

      clearCanvas: () => {
        get().commit();
        set({ nodes: [], edges: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        nodes: s.nodes,
        edges: s.edges,
        library: s.library,
        wireColor: s.wireColor,
        wireStyle: s.wireStyle,
        snap: s.snap,
      }),
    },
  ),
);
