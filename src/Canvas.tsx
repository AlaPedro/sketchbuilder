import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  useStoreApi,
  type Connection,
  type EdgeMouseHandler,
  type IsValidConnection,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnReconnect,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { WireEdge } from './edges/WireEdge';
import { ComponentNode } from './nodes/ComponentNode';
import { NoteNode } from './nodes/NoteNode';
import { PointNode } from './nodes/PointNode';
import { useAppStore } from './store';
import type { AppNode, WireEdgeT } from './types';
import { computeNet } from './utils';

const nodeTypes = { component: ComponentNode, point: PointNode, note: NoteNode };
const edgeTypes = { wire: WireEdge };
const MERGE_RADIUS = 16;

const clientPoint = (e: MouseEvent | TouchEvent | ReactMouseEvent) =>
  'changedTouches' in e ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };

export function Canvas() {
  const rf = useReactFlow<AppNode, WireEdgeT>();
  const flowStore = useStoreApi<AppNode, WireEdgeT>();
  const { nodes, edges, onNodesChange, onEdgesChange, tool, snap, wireColor } = useAppStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      tool: s.tool,
      snap: s.snap,
      wireColor: s.wireColor,
    })),
  );
  const actions = useAppStore.getState;
  // Só enquadra a tela ao abrir se já houver algo salvo; canvas vazio começa em zoom 100%.
  const [startWithFit] = useState(() => useAppStore.getState().nodes.length > 0);

  // Destaque do "net": todos os fios eletricamente ligados à seleção.
  const selKey = useAppStore(
    (s) =>
      s.edges.filter((e) => e.selected).map((e) => e.id).join(',') +
      '|' +
      s.nodes.filter((n) => n.selected && n.type === 'point').map((n) => n.id).join(','),
  );
  useEffect(() => {
    const [se, sp] = selKey.split('|');
    const net = computeNet(edges, se ? se.split(',') : [], sp ? sp.split(',') : []);
    useAppStore.setState({ net });
  }, [selKey, edges]);

  /** Centro de um nó em coordenadas do fluxo. */
  const nodeCenter = useCallback(
    (id: string) => {
      const n = flowStore.getState().nodeLookup.get(id);
      if (!n) return null;
      return {
        x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
        y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
      };
    },
    [flowStore],
  );

  const isValidConnection: IsValidConnection<WireEdgeT> = useCallback(
    (c) => c.source !== c.target || c.sourceHandle !== c.targetHandle,
    [],
  );

  const onConnect = useCallback((c: Connection) => actions().connect(c), [actions]);

  // Soltar o fio no vazio cria uma ponta solta ali.
  // (o React Flow também chama onConnectEnd durante reconexões; essas são tratadas em onReconnectEnd)
  const reconnecting = useRef(false);
  const reconnected = useRef(false);
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (reconnecting.current) return;
      if (state.isValid || state.toHandle || !state.fromNode || !state.fromHandle) return;
      const pos = rf.screenToFlowPosition(clientPoint(event));
      if (state.from && Math.hypot(pos.x - state.from.x, pos.y - state.from.y) < 15) return;
      actions().addDanglingWire(state.fromNode.id, state.fromHandle.id ?? null, pos);
    },
    [rf, actions],
  );

  // Arrastar a ponta de um fio de um pino para outro.
  const onReconnectStart = useCallback(() => {
    reconnecting.current = true;
    reconnected.current = false;
  }, []);
  const onReconnect: OnReconnect<WireEdgeT> = useCallback(
    (oldEdge, c) => {
      reconnected.current = true;
      actions().reconnect(oldEdge.id, c);
    },
    [actions],
  );
  const onReconnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, edge: WireEdgeT, _t: unknown, state: { fromNode: { id: string } | null; fromHandle: { id?: string | null } | null }) => {
      setTimeout(() => (reconnecting.current = false));
      if (reconnected.current || !state.fromNode) return;
      // O lado que ficou parado é o "from"; o outro lado vira ponta solta onde foi solto.
      const fixedIsSource = state.fromNode.id === edge.source && (state.fromHandle?.id ?? null) === (edge.sourceHandle ?? null);
      const pos = rf.screenToFlowPosition(clientPoint(event));
      actions().detachEnd(edge.id, fixedIsSource ? 'target' : 'source', pos);
    },
    [rf, actions],
  );

  const onEdgeClick: EdgeMouseHandler<WireEdgeT> = useCallback(
    (event, edge) => {
      const t = actions().tool;
      if (t === 'select') return;
      const pos = rf.screenToFlowPosition(clientPoint(event));
      if (t === 'join') return actions().splitEdge(edge.id, pos);
      const a = nodeCenter(edge.source);
      const b = nodeCenter(edge.target);
      let dir = { x: 1, y: 0 };
      if (a && b) {
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      }
      actions().cutEdge(edge.id, pos, dir);
    },
    [rf, actions, nodeCenter],
  );

  const onEdgeDoubleClick: EdgeMouseHandler<WireEdgeT> = useCallback(
    (event, edge) => {
      if (actions().tool !== 'select') return;
      actions().splitEdge(edge.id, rf.screenToFlowPosition(clientPoint(event)));
    },
    [rf, actions],
  );

  const onNodeDragStart: OnNodeDrag<AppNode> = useCallback(() => actions().commit(), [actions]);

  // Soltar um ponto (ponta solta/dobra/junção) em cima de um pino ou outro ponto = unir.
  const onNodeDragStop: OnNodeDrag<AppNode> = useCallback(
    (_e, node, dragged) => {
      if (node.type !== 'point' || dragged.length !== 1) return;
      const { nodeLookup } = flowStore.getState();
      const me = nodeCenter(node.id);
      if (!me) return;
      let best: { nodeId: string; handleId: string | null } | null = null;
      let bestD = MERGE_RADIUS;
      for (const [id, n] of nodeLookup) {
        if (id === node.id) continue;
        const hb = n.internals.handleBounds;
        for (const h of [...(hb?.source ?? []), ...(hb?.target ?? [])]) {
          const hx = n.internals.positionAbsolute.x + h.x + h.width / 2;
          const hy = n.internals.positionAbsolute.y + h.y + h.height / 2;
          const d = Math.hypot(hx - me.x, hy - me.y);
          if (d < bestD) {
            bestD = d;
            best = { nodeId: id, handleId: h.id ?? null };
          }
        }
      }
      if (best) actions().mergePoint(node.id, best.nodeId, best.handleId);
    },
    [flowStore, nodeCenter, actions],
  );

  const onBeforeDelete = useCallback(async () => {
    actions().commit();
    return true;
  }, [actions]);
  const onDelete = useCallback(
    ({ nodes: dn, edges: de }: { nodes: AppNode[]; edges: WireEdgeT[] }) => actions().afterDelete(dn, de),
    [actions],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/sketchmaker-template')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      const id = e.dataTransfer.getData('application/sketchmaker-template');
      const t = actions().library.find((x) => x.id === id);
      if (!t) return;
      e.preventDefault();
      actions().addFromTemplate(t, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [rf, actions],
  );

  return (
    <div className={`canvas tool-${tool}`} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<AppNode, WireEdgeT>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onBeforeDelete={onBeforeDelete}
        onDelete={onDelete}
        onPaneContextMenu={(e) => e.preventDefault()}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={24}
        connectionLineStyle={{ stroke: wireColor, strokeWidth: 2.5 }}
        nodesConnectable={tool === 'select'}
        edgesReconnectable={tool === 'select'}
        reconnectRadius={12}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        snapToGrid={snap}
        snapGrid={[10, 10]}
        minZoom={0.2}
        maxZoom={4}
        fitView={startWithFit}
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        defaultViewport={{ x: 80, y: 120, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Lines} gap={20} color="#eef0f2" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) => (n.type === 'component' ? '#adb5bd' : 'transparent')}
          maskColor="rgba(240,240,245,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
