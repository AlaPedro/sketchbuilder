import { useMemo, useState } from 'react';
import { ComponentBody } from '../nodes/ComponentBody';
import { useAppStore } from '../store';
import type { PinMap, Side } from '../types';
import { SIDES } from '../types';
import { COMPONENT_COLORS, autoSize, parsePinText, pinNames, reconcilePins, uid } from '../utils';
import { useViewCenter } from './Sidebar';

const SIDE_LABEL: Record<Side, string> = {
  top: 'Cima (esq → dir)',
  right: 'Direita (cima → baixo)',
  bottom: 'Baixo (esq → dir)',
  left: 'Esquerda (cima → baixo)',
};

const PREVIEW_W = 460;
const PREVIEW_H = 240;

export function ComponentEditor() {
  const editor = useAppStore((s) => s.editor);
  if (!editor) return null;
  return <EditorDialog key={JSON.stringify(editor)} />;
}

function EditorDialog() {
  const st = useAppStore.getState();
  const editor = st.editor!;
  const viewCenter = useViewCenter();

  const initial = useMemo(() => {
    if (editor.mode === 'node') {
      const n = st.nodes.find((x) => x.id === editor.nodeId);
      if (n?.type === 'component')
        return {
          label: n.data.label,
          color: n.data.color,
          names: pinNames(n.data.pins),
          prevPins: n.data.pins as PinMap | undefined,
          size: { width: n.width ?? n.measured?.width ?? 0, height: n.height ?? n.measured?.height ?? 0 },
        };
    }
    if (editor.mode === 'template') {
      const t = st.library.find((x) => x.id === editor.templateId);
      if (t) return { label: t.label, color: t.color, names: t.pins, prevPins: undefined, size: undefined };
    }
    return {
      label: 'Componente',
      color: '#ffffff',
      names: { top: [], right: [], bottom: ['+', '-'], left: [] } as Record<Side, string[]>,
      prevPins: undefined,
      size: undefined,
    };
  }, [editor, st.nodes, st.library]);

  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState(initial.color);
  const [texts, setTexts] = useState<Record<Side, string>>(() => ({
    top: initial.names.top.join(', '),
    right: initial.names.right.join(', '),
    bottom: initial.names.bottom.join(', '),
    left: initial.names.left.join(', '),
  }));
  const [saveToLib, setSaveToLib] = useState(editor.mode === 'new');

  const names = useMemo(
    () =>
      ({
        top: parsePinText(texts.top),
        right: parsePinText(texts.right),
        bottom: parsePinText(texts.bottom),
        left: parsePinText(texts.left),
      }) as Record<Side, string[]>,
    [texts],
  );
  const pins = useMemo(() => reconcilePins(names, initial.prevPins), [names, initial.prevPins]);
  const size = useMemo(() => {
    const auto = autoSize(names, label);
    if (!initial.size) return auto;
    return { width: Math.max(auto.width, initial.size.width), height: Math.max(auto.height, initial.size.height) };
  }, [names, label, initial.size]);

  const scale = Math.min(1, (PREVIEW_W - 60) / size.width, (PREVIEW_H - 60) / size.height);
  const close = () => st.set({ editor: null });

  const save = () => {
    if (editor.mode === 'node') {
      st.updateComponent(editor.nodeId, { label, color, pins, ...size });
    } else if (editor.mode === 'template') {
      st.saveTemplate({ id: editor.templateId, label, color, pins: names });
    } else {
      st.addComponent({ label, color, pins, ...size }, viewCenter());
      if (saveToLib) st.saveTemplate({ id: uid('tpl_'), label, color, pins: names });
    }
    close();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div className="modal-head">
          {editor.mode === 'new' ? 'Novo componente' : editor.mode === 'template' ? 'Editar modelo' : 'Editar componente'}
        </div>

        <div className="modal-body">
          <div className="form">
            <label>
              Nome
              <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="field">
              Cor
              <div className="ins-row">
                {COMPONENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`swatch${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="hint">Pinos de cada lado separados por vírgula ou um por linha. Ex.: 3V3, GND, D15</div>
            <div className="sides">
              {SIDES.map((side) => (
                <label key={side}>
                  {SIDE_LABEL[side]} <span className="count">{names[side].length}</span>
                  <textarea
                    rows={2}
                    value={texts[side]}
                    placeholder="—"
                    onChange={(e) => setTexts((t) => ({ ...t, [side]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="preview" style={{ width: PREVIEW_W, height: PREVIEW_H }}>
            <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, position: 'relative' }}>
              <ComponentBody
                label={label}
                color={color}
                pins={pins}
                renderTip={(side, pin, style) => <span key={pin.id} className={`preview-tip preview-tip-${side}`} style={style} />}
              />
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {editor.mode === 'new' && (
            <label className="check">
              <input type="checkbox" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} />
              Salvar também na biblioteca
            </label>
          )}
          {editor.mode === 'node' && <span className="hint">Fios ligados a pinos removidos serão apagados.</span>}
          <div className="spacer" />
          <button className="ghost-btn" onClick={close}>
            Cancelar
          </button>
          <button className="primary-btn" onClick={save}>
            {editor.mode === 'new' ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

