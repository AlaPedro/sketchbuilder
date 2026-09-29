import { useReactFlow } from '@xyflow/react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { extractJson, fromSimple, isSimpleCircuit, type ImportResult } from '../simple';
import { useAppStore } from '../store';
import type { AppNode, WireEdgeT } from '../types';

/** Interpreta o texto colado: formato simplificado (IA) ou arquivo completo antigo. */
export function parseCircuitText(text: string): ImportResult {
  const data = extractJson(text) as Record<string, unknown>;
  if (isSimpleCircuit(data)) return fromSimple(data, useAppStore.getState().library);
  if (Array.isArray(data.nodes) && Array.isArray(data.edges))
    return { nodes: data.nodes as AppNode[], edges: data.edges as WireEdgeT[], warnings: [] };
  throw new Error('o JSON não tem "components" (formato simplificado) nem "nodes"/"edges"');
}

export function PasteDialog() {
  const open = useAppStore((s) => s.pasteOpen);
  if (!open) return null;
  return <Dialog />;
}

function Dialog() {
  const rf = useReactFlow();
  const [text, setText] = useState('');
  const hasCanvas = useAppStore((s) => s.nodes.length > 0);
  const close = () => useAppStore.getState().set({ pasteOpen: false });

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, result: parseCircuitText(text) };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  }, [text]);

  const apply = (mode: 'replace' | 'add') => {
    if (!parsed?.ok) return;
    useAppStore.getState().importCircuit(parsed.result.nodes, parsed.result.edges, mode);
    close();
    setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1.2, duration: 300 }), 60);
  };

  const comps = parsed?.ok ? parsed.result.nodes.filter((n) => n.type === 'component').length : 0;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal paste-modal" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div className="modal-head">Colar resposta da IA</div>
        <div className="modal-body paste-body">
          <div className="hint">
            Cole aqui a resposta inteira da IA (pode ter texto em volta) ou só o JSON. Eu pego o bloco do circuito.
          </div>
          <textarea
            className="paste-area"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'```json\n{ "app": "sketchmaker", "format": "simple", "components": [...], "wires": [...] }\n```'}
          />
          {parsed && !parsed.ok && (
            <div className="paste-status error">
              <AlertTriangle size={15} /> {parsed.error}
            </div>
          )}
          {parsed?.ok && (
            <div className="paste-status ok">
              <CheckCircle2 size={15} /> {comps} componente(s), {parsed.result.edges.length} fio(s)
            </div>
          )}
          {parsed?.ok && parsed.result.warnings.length > 0 && (
            <ul className="paste-warnings">
              {parsed.result.warnings.map((w, i) => (
                <li key={i}>
                  <AlertTriangle size={13} /> {w}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-foot">
          <span className="hint">Dá para desfazer com Ctrl+Z.</span>
          <div className="spacer" />
          <button className="ghost-btn" onClick={close}>
            Cancelar
          </button>
          {hasCanvas && (
            <button className="ghost-btn" disabled={!parsed?.ok} onClick={() => apply('add')}>
              Adicionar ao canvas
            </button>
          )}
          <button className="primary-btn" disabled={!parsed?.ok} onClick={() => apply('replace')}>
            {hasCanvas ? 'Substituir canvas' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
