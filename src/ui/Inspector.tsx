import { useReactFlow } from '@xyflow/react';
import { BookmarkPlus, Copy, Pencil, RotateCw, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { SIDES } from '../types';
import { COMPONENT_COLORS, WIRE_COLORS } from '../utils';

export function Inspector() {
  const rf = useReactFlow();
  const sel = {
    nodes: useAppStore(useShallow((s) => s.nodes.filter((n) => n.selected))),
    edges: useAppStore(useShallow((s) => s.edges.filter((e) => e.selected))),
    netSize: useAppStore((s) => s.net.size),
  };
  const st = useAppStore.getState();

  const comps = sel.nodes.filter((n) => n.type === 'component');
  const points = sel.nodes.filter((n) => n.type === 'point');
  const nothing = !sel.nodes.length && !sel.edges.length;

  if (nothing) return <Help />;

  const del = () => rf.deleteElements({ nodes: sel.nodes, edges: sel.edges });

  return (
    <div className="inspector">
      {comps.length === 1 && sel.nodes.length === 1 && (
        <>
          <div className="ins-title">Componente</div>
          <input
            className="ins-input"
            key={comps[0].id}
            defaultValue={comps[0].data.label}
            onBlur={(e) => {
              if (e.target.value !== comps[0].data.label) st.patchComponent(comps[0].id, { label: e.target.value });
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <div className="ins-row">
            {COMPONENT_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch${comps[0].data.color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => st.patchComponent(comps[0].id, { color: c })}
              />
            ))}
          </div>
          <div className="ins-meta">
            {SIDES.reduce((n, s) => n + comps[0].data.pins[s].length, 0)} pinos
          </div>
          <div className="ins-actions">
            <button onClick={() => st.set({ editor: { mode: 'node', nodeId: comps[0].id } })}>
              <Pencil size={14} /> Editar pinos
            </button>
            <button onClick={() => st.saveNodeAsTemplate(comps[0].id)}>
              <BookmarkPlus size={14} /> Salvar na biblioteca
            </button>
          </div>
        </>
      )}

      {sel.nodes.length > 1 && <div className="ins-title">{sel.nodes.length} itens selecionados</div>}

      {sel.edges.length > 0 && (
        <>
          <div className="ins-title">
            {sel.edges.length === 1 ? 'Fio' : `${sel.edges.length} fios`}
          </div>
          <div className="ins-row">
            {WIRE_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch${sel.edges.every((e) => e.data?.color === c) ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => st.recolorSelected(c)}
              />
            ))}
          </div>
          <div className="ins-meta">Ligação destacada: {sel.netSize} fio(s) no mesmo circuito</div>
          <div className="ins-meta">Duplo clique no fio cria uma dobra/junção.</div>
        </>
      )}

      {points.length === 1 && sel.nodes.length === 1 && (
        <>
          <div className="ins-title">Ponto de fio</div>
          <div className="ins-meta">
            Arraste a borda até um pino ou outro ponto para unir. Arraste o centro para puxar um fio novo.
          </div>
        </>
      )}

      <div className="ins-actions">
        {comps.length > 0 && (
          <button onClick={st.rotateSelected} title="R">
            <RotateCw size={14} /> Girar 90°
          </button>
        )}
        {sel.nodes.length > 0 && (
          <button onClick={st.duplicateSelected} title="Ctrl+D">
            <Copy size={14} /> Duplicar
          </button>
        )}
        <button className="danger" onClick={del} title="Delete">
          <Trash2 size={14} /> Apagar
        </button>
      </div>
    </div>
  );
}

function Help() {
  return (
    <div className="inspector help">
      <div className="ins-title">Atalhos</div>
      <ul>
        <li><b>Arrastar de um pino</b> até outro pino: cria um fio</li>
        <li><b>Soltar o fio no vazio</b>: deixa uma ponta solta</li>
        <li><b>Arrastar ponta solta</b> sobre um pino: une</li>
        <li><b>Duplo clique no fio</b>: cria dobra/junção</li>
        <li><kbd>C</kbd> tesoura · <kbd>J</kbd> junção · <kbd>V</kbd> selecionar</li>
        <li><kbd>R</kbd> girar · <kbd>Ctrl+D</kbd> duplicar · <kbd>Del</kbd> apagar</li>
        <li><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> desfazer / refazer</li>
        <li>Arrastar no vazio: seleção · botão do meio / espaço: mover a tela · Ctrl+scroll: zoom</li>
      </ul>
    </div>
  );
}
