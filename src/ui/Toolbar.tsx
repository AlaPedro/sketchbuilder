import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';
import {
  CircleDot,
  CornerDownRight,
  Download,
  Grid3x3,
  ImageDown,
  Minus,
  MousePointer2,
  Redo2,
  Scissors,
  Spline,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type ProjectFile } from '../store';
import type { AppNode, Tool, WireEdgeT, WireStyle } from '../types';
import { WIRE_COLORS } from '../utils';

function Btn(props: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`tb-btn${props.active ? ' active' : ''}`}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

const TOOLS: { id: Tool; title: string; icon: ReactNode }[] = [
  { id: 'select', title: 'Selecionar / ligar pinos (V)', icon: <MousePointer2 size={18} /> },
  { id: 'join', title: 'Junção: clique num fio para criar um ponto de união (J)', icon: <CircleDot size={18} /> },
  { id: 'cut', title: 'Tesoura: clique num fio para cortar (C)', icon: <Scissors size={18} /> },
];

const STYLES: { id: WireStyle; title: string; icon: ReactNode }[] = [
  { id: 'curvy', title: 'Fios curvos', icon: <Spline size={18} /> },
  { id: 'straight', title: 'Fios retos', icon: <Minus size={18} /> },
  { id: 'step', title: 'Fios em ângulo reto', icon: <CornerDownRight size={18} /> },
];

export function Toolbar() {
  const rf = useReactFlow<AppNode, WireEdgeT>();
  const fileInput = useRef<HTMLInputElement>(null);
  const s = useAppStore(
    useShallow((st) => ({
      tool: st.tool,
      wireColor: st.wireColor,
      wireStyle: st.wireStyle,
      snap: st.snap,
      canUndo: st.past.length > 0,
      canRedo: st.future.length > 0,
    })),
  );
  const { set, undo, redo, recolorSelected, clearCanvas, loadProject } = useAppStore.getState();

  const exportJson = () => {
    const { nodes, edges, library } = useAppStore.getState();
    const data: ProjectFile = {
      app: 'sketchmaker',
      version: 1,
      nodes: nodes.map((n) => ({ ...n, selected: false })),
      edges: edges.map((e) => ({ ...e, selected: false })),
      library,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(URL.createObjectURL(blob), `circuito-${stamp()}.json`);
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ProjectFile;
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('formato inválido');
      loadProject(data);
      setTimeout(() => rf.fitView({ padding: 0.2 }), 50);
    } catch (err) {
      alert(`Não consegui abrir o arquivo: ${(err as Error).message}`);
    }
  };

  const exportPng = async () => {
    const nodes = rf.getNodes();
    if (!nodes.length) return;
    // Enquadra componentes + curvas dos fios (que podem sair da área dos nós), em escala 1:1.
    const pad = 40;
    const nb = getNodesBounds(nodes);
    let minX = nb.x;
    let minY = nb.y;
    let maxX = nb.x + nb.width;
    let maxY = nb.y + nb.height;
    document.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach((p) => {
      const b = p.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    const width = Math.ceil(maxX - minX + pad * 2);
    const height = Math.ceil(maxY - minY + pad * 2);
    const el = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!el) return;
    const url = await toPng(el, {
      backgroundColor: '#ffffff',
      width,
      height,
      pixelRatio: 2,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${pad - minX}px, ${pad - minY}px) scale(1)` },
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('react-flow__resize-control')),
    });
    download(url, `circuito-${stamp()}.png`);
  };

  return (
    <div className="toolbar">
      <div className="tb-group">
        {TOOLS.map((t) => (
          <Btn key={t.id} title={t.title} active={s.tool === t.id} onClick={() => set({ tool: t.id })}>
            {t.icon}
          </Btn>
        ))}
      </div>
      <div className="tb-sep" />
      <div className="tb-group swatches" title="Cor do fio (também recolore os fios selecionados)">
        {WIRE_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch${s.wireColor === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => recolorSelected(c)}
          />
        ))}
      </div>
      <div className="tb-sep" />
      <div className="tb-group">
        {STYLES.map((st) => (
          <Btn key={st.id} title={st.title} active={s.wireStyle === st.id} onClick={() => set({ wireStyle: st.id })}>
            {st.icon}
          </Btn>
        ))}
        <Btn title="Alinhar à grade" active={s.snap} onClick={() => set({ snap: !s.snap })}>
          <Grid3x3 size={18} />
        </Btn>
      </div>
      <div className="tb-sep" />
      <div className="tb-group">
        <Btn title="Desfazer (Ctrl+Z)" disabled={!s.canUndo} onClick={undo}>
          <Undo2 size={18} />
        </Btn>
        <Btn title="Refazer (Ctrl+Y)" disabled={!s.canRedo} onClick={redo}>
          <Redo2 size={18} />
        </Btn>
      </div>
      <div className="tb-sep" />
      <div className="tb-group">
        <Btn title="Exportar projeto (.json)" onClick={exportJson}>
          <Download size={18} />
        </Btn>
        <Btn title="Abrir projeto (.json)" onClick={() => fileInput.current?.click()}>
          <Upload size={18} />
        </Btn>
        <Btn title="Exportar imagem (.png)" onClick={exportPng}>
          <ImageDown size={18} />
        </Btn>
        <Btn
          title="Limpar canvas"
          onClick={() => {
            if (confirm('Apagar tudo do canvas? (dá para desfazer com Ctrl+Z)')) clearCanvas();
          }}
        >
          <Trash2 size={18} />
        </Btn>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
