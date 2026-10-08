import { Position } from '@xyflow/react';
import type { PinMap, Side, Template, WireEdgeT } from './types';
import { SIDES } from './types';

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const POINT_SIZE = 20;
export const POINT_HANDLE = 'p';
export const PIN_GAP = 22;
export const STUB = 12;

export const WIRE_COLORS = [
  '#e03131', // vermelho
  '#1e1e1e', // preto
  '#1971c2', // azul
  '#2f9e44', // verde
  '#f08c00', // laranja
  '#9c36b5', // roxo
  '#fab005', // amarelo
  '#868e96', // cinza
  '#8b5a2b', // marrom
  '#ffffff', // branco
  '#e64980', // rosa
  '#15aabf', // ciano
  '#82c91e', // verde-limão
  '#364fc7', // azul-escuro
];

/** Cores claras (ex.: fio branco) precisam de contorno para aparecer no fundo branco. */
export function isLightColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const lum = 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
  return lum > 200;
}

export const COMPONENT_COLORS = [
  '#ffffff',
  '#e9ecef',
  '#ffe3e3',
  '#fff3bf',
  '#d3f9d8',
  '#d0ebff',
  '#f3d9fa',
  '#ffe8cc',
];

export const emptyPins = (): PinMap => ({ top: [], right: [], bottom: [], left: [] });

export const pinPct = (index: number, count: number) => ((index + 0.5) / count) * 100;

export function parsePinText(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Converte nomes em pinos, reaproveitando o id do pino que estava no mesmo lado/índice
 *  (assim renomear um pino não desconecta os fios). */
export function reconcilePins(names: Record<Side, string[]>, previous?: PinMap): PinMap {
  const out = emptyPins();
  for (const side of SIDES) {
    out[side] = names[side].map((name, i) => ({ id: previous?.[side][i]?.id ?? uid('pin_'), name }));
  }
  return out;
}

export const pinNames = (pins: PinMap): Record<Side, string[]> => ({
  top: pins.top.map((p) => p.name),
  right: pins.right.map((p) => p.name),
  bottom: pins.bottom.map((p) => p.name),
  left: pins.left.map((p) => p.name),
});

const CHAR_W = 6.6;
const ceil10 = (n: number) => Math.ceil(n / 10) * 10;

export function autoSize(pins: Record<Side, { name: string }[] | string[]>, label: string) {
  const len = (arr: ({ name: string } | string)[]) =>
    arr.reduce<number>((m, p) => Math.max(m, (typeof p === 'string' ? p : p.name).length), 0);
  const lab = (arr: ({ name: string } | string)[]) => (arr.length ? len(arr) * CHAR_W + 12 : 0);
  const labelW = label.length * 9 + 20;
  const w = Math.max(
    60,
    Math.max(pins.top.length, pins.bottom.length) * PIN_GAP,
    lab(pins.left) + lab(pins.right) + labelW,
  );
  const h = Math.max(
    40,
    Math.max(pins.left.length, pins.right.length) * PIN_GAP,
    lab(pins.top) + lab(pins.bottom) + 28,
  );
  return { width: ceil10(w), height: ceil10(h) };
}

/** Gira os pinos 90° no sentido horário. */
export function rotatePinsCW(p: PinMap): PinMap {
  return {
    right: p.top,
    bottom: [...p.right].reverse(),
    left: p.bottom,
    top: [...p.left].reverse(),
  };
}

export function templateToPins(t: Template): PinMap {
  return reconcilePins(t.pins);
}

export const SIDE_POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Direção de saída de um fio num ponto solto, deduzida a partir da outra ponta. */
export function inferPosition(x: number, y: number, ox: number, oy: number): Position {
  const dx = ox - x;
  const dy = oy - y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
  return dy >= 0 ? Position.Bottom : Position.Top;
}

const endKey = (node: string, handle?: string | null) => `${node}::${handle ?? ''}`;

/** Todos os fios eletricamente ligados aos fios/pontos selecionados. */
export function computeNet(edges: WireEdgeT[], selEdges: string[], selPoints: string[]): Set<string> {
  const net = new Set<string>();
  if (!selEdges.length && !selPoints.length) return net;
  const adj = new Map<string, WireEdgeT[]>();
  const add = (k: string, e: WireEdgeT) => {
    const list = adj.get(k);
    if (list) list.push(e);
    else adj.set(k, [e]);
  };
  for (const e of edges) {
    add(endKey(e.source, e.sourceHandle), e);
    add(endKey(e.target, e.targetHandle), e);
  }
  const stack: string[] = selPoints.map((p) => endKey(p, POINT_HANDLE));
  for (const e of edges) {
    if (selEdges.includes(e.id)) stack.push(endKey(e.source, e.sourceHandle), endKey(e.target, e.targetHandle));
  }
  const seen = new Set<string>();
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const e of adj.get(k) ?? []) {
      net.add(e.id);
      const a = endKey(e.source, e.sourceHandle);
      stack.push(a === k ? endKey(e.target, e.targetHandle) : a);
    }
  }
  return net;
}

