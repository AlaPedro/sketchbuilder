/**
 * Formato simplificado do circuito, pensado para ser lido e escrito por uma IA:
 * componentes por nome, pinos por nome e fios "id.PINO" -> "id.PINO".
 * A especificação que vai para a IA está em aiPrompt.ts.
 */
import type { AppNode, ComponentNodeT, NoteNodeT, PinMap, Side, Template, WireEdgeT } from './types';
import { SIDES } from './types';
import { COMPONENT_COLORS, WIRE_COLORS, autoSize, reconcilePins, uid } from './utils';

export interface SimpleComponent {
  id: string;
  label?: string;
  template?: string;
  pins?: Partial<Record<Side, string[]>> | string[];
  color?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface SimpleWire {
  from: string;
  to: string;
  color?: string;
}

export type SimpleNote = string | { text: string; x?: number; y?: number };

export interface SimpleCircuit {
  app: 'sketchmaker';
  format: 'simple';
  version: 1;
  components: SimpleComponent[];
  wires: SimpleWire[];
  notes?: SimpleNote[];
}

const WIRE_COLOR_NAMES: Record<string, string> = {
  red: WIRE_COLORS[0],
  black: WIRE_COLORS[1],
  blue: WIRE_COLORS[2],
  green: WIRE_COLORS[3],
  orange: WIRE_COLORS[4],
  purple: WIRE_COLORS[5],
  yellow: WIRE_COLORS[6],
  gray: WIRE_COLORS[7],
  brown: WIRE_COLORS[8],
  white: WIRE_COLORS[9],
  pink: WIRE_COLORS[10],
  cyan: WIRE_COLORS[11],
  lime: WIRE_COLORS[12],
  navy: WIRE_COLORS[13],
};
export const WIRE_COLOR_LIST = Object.keys(WIRE_COLOR_NAMES);

const COMPONENT_COLOR_NAMES: Record<string, string> = {
  white: COMPONENT_COLORS[0],
  gray: COMPONENT_COLORS[1],
  red: COMPONENT_COLORS[2],
  yellow: COMPONENT_COLORS[3],
  green: COMPONENT_COLORS[4],
  blue: COMPONENT_COLORS[5],
  purple: COMPONENT_COLORS[6],
  orange: COMPONENT_COLORS[7],
};

const colorName = (hex: string, table: Record<string, string>) =>
  Object.entries(table).find(([, v]) => v.toLowerCase() === hex.toLowerCase())?.[0] ?? hex;

const colorHex = (c: string | undefined, table: Record<string, string>, fallback: string) => {
  if (!c) return fallback;
  const key = c.trim().toLowerCase();
  if (table[key]) return table[key];
  return /^#[0-9a-f]{3,8}$/i.test(key) ? key : fallback;
};

const norm = (s: string) => s.trim().toLowerCase();

function slug(label: string) {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'comp'
  );
}

/** Pinos na ordem canônica (top, right, bottom, left), usada para numerar nomes repetidos. */
const orderedPins = (pins: PinMap) => SIDES.flatMap((s) => pins[s]);

const samePinNames = (pins: PinMap, t: Template) =>
  SIDES.every((s) => pins[s].length === t.pins[s].length && pins[s].every((p, i) => p.name === t.pins[s][i]));

const findTemplate = (library: Template[], name: string) =>
  library.find((t) => norm(t.label) === norm(name) || norm(t.id) === norm(name));

/* ------------------------------------------------------------------ */
/* canvas -> simples                                                   */
/* ------------------------------------------------------------------ */

export function toSimple(nodes: AppNode[], edges: WireEdgeT[], library: Template[]): SimpleCircuit {
  const comps = nodes.filter((n): n is ComponentNodeT => n.type === 'component');
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const n of comps) {
    const base = n.data.ref ? slug(n.data.ref) : slug(n.data.label);
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
    used.add(id);
    ids.set(n.id, id);
  }

  const components: SimpleComponent[] = comps.map((n) => {
    const t = library.find((x) => x.label === n.data.label && samePinNames(n.data.pins, x));
    const out: SimpleComponent = { id: ids.get(n.id)! };
    if (t) out.template = t.label;
    else {
      out.label = n.data.label;
      const pins: Partial<Record<Side, string[]>> = {};
      for (const s of SIDES) if (n.data.pins[s].length) pins[s] = n.data.pins[s].map((p) => p.name);
      out.pins = pins;
    }
    if (n.data.color !== (t?.color ?? COMPONENT_COLORS[0])) out.color = colorName(n.data.color, COMPONENT_COLOR_NAMES);
    out.x = Math.round(n.position.x);
    out.y = Math.round(n.position.y);
    const def = t?.width && t.height ? { width: t.width, height: t.height } : autoSize(n.data.pins, n.data.label);
    if (n.width && n.width !== def.width) out.w = Math.round(n.width);
    if (n.height && n.height !== def.height) out.h = Math.round(n.height);
    return out;
  });

  const byNode = new Map(comps.map((n) => [n.id, n]));
  const pinRef = (nodeId: string, handle: string | null | undefined): string | null => {
    const n = byNode.get(nodeId);
    if (!n) return null;
    const all = orderedPins(n.data.pins);
    const pin = all.find((p) => p.id === handle);
    if (!pin) return null;
    const nth = all.filter((p) => p.name === pin.name).indexOf(pin) + 1;
    return `${ids.get(nodeId)}.${pin.name}${nth > 1 ? `#${nth}` : ''}`;
  };

  // Fios diretos pino-pino saem como estão. Fios que passam por pontos (dobras/junções)
  // são agrupados por "ilha" de pontos e viram ligações diretas entre os pinos da ilha.
  const isPoint = (id: string) => nodes.find((n) => n.id === id)?.type === 'point';
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const e of edges) {
    if (isPoint(e.source) && isPoint(e.target)) parent.set(find(e.source), find(e.target));
  }

  const wires: SimpleWire[] = [];
  const islands = new Map<string, { ref: string; color: string }[]>();
  const color = (e: WireEdgeT) => colorName(e.data?.color ?? WIRE_COLORS[1], WIRE_COLOR_NAMES);
  for (const e of edges) {
    const sp = isPoint(e.source);
    const tp = isPoint(e.target);
    if (!sp && !tp) {
      const from = pinRef(e.source, e.sourceHandle);
      const to = pinRef(e.target, e.targetHandle);
      if (from && to) wires.push({ from, to, color: color(e) });
    } else if (sp !== tp) {
      const ref = sp ? pinRef(e.target, e.targetHandle) : pinRef(e.source, e.sourceHandle);
      if (!ref) continue;
      const root = find(sp ? e.source : e.target);
      const list = islands.get(root) ?? [];
      if (!list.some((x) => x.ref === ref)) list.push({ ref, color: color(e) });
      islands.set(root, list);
    }
  }
  for (const list of islands.values()) {
    for (let i = 1; i < list.length; i++) wires.push({ from: list[i - 1].ref, to: list[i].ref, color: list[i].color });
  }

  const notes: SimpleNote[] = nodes
    .filter((n): n is NoteNodeT => n.type === 'note')
    .map((n) => ({ text: n.data.text, x: Math.round(n.position.x), y: Math.round(n.position.y) }));

  const out: SimpleCircuit = { app: 'sketchmaker', format: 'simple', version: 1, components, wires };
  if (notes.length) out.notes = notes;
  return out;
}

/* ------------------------------------------------------------------ */
/* simples -> canvas                                                   */
/* ------------------------------------------------------------------ */

export interface ImportResult {
  nodes: AppNode[];
  edges: WireEdgeT[];
  warnings: string[];
}

export const isSimpleCircuit = (d: unknown): d is SimpleCircuit =>
  !!d && typeof d === 'object' && Array.isArray((d as SimpleCircuit).components);

function toPinNames(p: SimpleComponent['pins']): Record<Side, string[]> | null {
  if (!p) return null;
  const names = { top: [], right: [], bottom: [], left: [] } as Record<Side, string[]>;
  if (Array.isArray(p)) {
    names.left = p.map(String);
    return names;
  }
  for (const s of SIDES) names[s] = (p[s] ?? []).map(String);
  return names;
}

export function fromSimple(input: SimpleCircuit, library: Template[]): ImportResult {
  const warnings: string[] = [];
  const nodes: AppNode[] = [];
  const edges: WireEdgeT[] = [];
  const byId = new Map<string, ComponentNodeT>();

  const pending: ComponentNodeT[] = [];
  for (const [i, c] of input.components.entries()) {
    const key = String(c.id ?? `comp${i + 1}`);
    if (byId.has(norm(key))) {
      warnings.push(`Componente "${key}" repetido — ignorei o segundo.`);
      continue;
    }
    const t = c.template ? findTemplate(library, c.template) : undefined;
    if (c.template && !t && !c.pins) warnings.push(`Modelo "${c.template}" não está na biblioteca e "${key}" não define pinos.`);
    const names = toPinNames(c.pins) ?? t?.pins ?? { top: [], right: [], bottom: [], left: [] };
    const pins = reconcilePins(names);
    const label = c.label ?? t?.label ?? c.template ?? key;
    const def = t?.width && t.height && !c.pins ? { width: t.width, height: t.height } : autoSize(names, label);
    const node: ComponentNodeT = {
      id: uid('c_'),
      type: 'component',
      position: { x: 0, y: 0 },
      width: c.w ?? def.width,
      height: c.h ?? def.height,
      data: { label, color: colorHex(c.color, COMPONENT_COLOR_NAMES, t?.color ?? COMPONENT_COLORS[0]), pins, ref: key },
    };
    if (typeof c.x === 'number' && typeof c.y === 'number') node.position = { x: c.x, y: c.y };
    else pending.push(node);
    byId.set(norm(key), node);
    nodes.push(node);
  }

  layoutPending(nodes as ComponentNodeT[], pending);

  const resolve = (ref: unknown): { node: string; handle: string } | null => {
    if (typeof ref !== 'string' || !ref.includes('.')) {
      warnings.push(`Referência de pino inválida: ${JSON.stringify(ref)} (use "id.PINO").`);
      return null;
    }
    const dot = ref.indexOf('.');
    const compKey = ref.slice(0, dot);
    const [pinName, nthStr] = ref.slice(dot + 1).split('#');
    const n = byId.get(norm(compKey));
    if (!n) {
      warnings.push(`Fio para "${ref}": componente "${compKey}" não existe.`);
      return null;
    }
    const all = orderedPins(n.data.pins);
    let matches = all.filter((p) => p.name === pinName.trim());
    if (!matches.length) matches = all.filter((p) => norm(p.name) === norm(pinName));
    const pin = matches[Math.max(0, (Number(nthStr) || 1) - 1)];
    if (!pin) {
      const list = [...new Set(all.map((p) => p.name))].join(', ') || 'nenhum';
      warnings.push(`Fio para "${ref}": pino "${pinName}" não existe em "${compKey}" (pinos: ${list}).`);
      return null;
    }
    return { node: n.id, handle: pin.id };
  };

  for (const w of input.wires ?? []) {
    const a = resolve(w.from);
    const b = resolve(w.to);
    if (!a || !b) continue;
    if (a.node === b.node && a.handle === b.handle) continue;
    edges.push({
      id: uid('w_'),
      type: 'wire',
      source: a.node,
      sourceHandle: a.handle,
      target: b.node,
      targetHandle: b.handle,
      data: { color: colorHex(w.color, WIRE_COLOR_NAMES, WIRE_COLORS[1]) },
    });
  }

  const comps = nodes as ComponentNodeT[];
  // Notas sem posição ficam empilhadas acima do circuito.
  const noteList = (input.notes ?? []).map((raw) => (typeof raw === 'string' ? { text: raw } : raw));
  const loose = noteList.filter((n) => n && typeof n.x !== 'number').length;
  const top = comps.length ? Math.min(...comps.map((n) => n.position.y)) : 0;
  const left = comps.length ? Math.min(...comps.map((n) => n.position.x)) : 0;
  let stacked = 0;
  noteList.forEach((note) => {
    if (!note || typeof note.text !== 'string') return;
    nodes.push({
      id: uid('n_'),
      type: 'note',
      position:
        typeof note.x === 'number' && typeof note.y === 'number'
          ? { x: note.x, y: note.y }
          : { x: left, y: top - 70 - (loose - 1 - stacked++) * 34 },
      data: { text: note.text },
    } satisfies NoteNodeT);
  });

  return { nodes, edges, warnings };
}

/** Posiciona componentes sem x/y: o com mais pinos no topo, os demais em fileiras abaixo. */
function layoutPending(all: ComponentNodeT[], pending: ComponentNodeT[]) {
  if (!pending.length) return;
  const placed = all.filter((n) => !pending.includes(n));
  const GAP = 90;
  const ROW_MAX = 1100;
  let x0 = 0;
  let y = 0;
  if (placed.length) {
    x0 = Math.min(...placed.map((n) => n.position.x));
    y = Math.max(...placed.map((n) => n.position.y + (n.height ?? 0))) + GAP + 40;
  }
  const pinCount = (n: ComponentNodeT) => orderedPins(n.data.pins).length;
  const queue = [...pending].sort((a, b) => pinCount(b) - pinCount(a));
  if (!placed.length) {
    const first = queue.shift()!;
    first.position = { x: x0, y };
    y += (first.height ?? 0) + GAP + 40;
  }
  let x = x0;
  let rowH = 0;
  for (const n of queue) {
    const w = n.width ?? 100;
    if (x > x0 && x + w > x0 + ROW_MAX) {
      x = x0;
      y += rowH + GAP;
      rowH = 0;
    }
    n.position = { x, y };
    x += w + GAP;
    rowH = Math.max(rowH, n.height ?? 0);
  }
}

/** Extrai o JSON de uma resposta de IA (pode vir dentro de ```json ... ``` e com texto em volta). */
export function extractJson(text: string): unknown {
  const candidates = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  candidates.push(text);
  let lastError: unknown = null;
  for (const body of candidates) {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    try {
      const data = JSON.parse(body.slice(start, end + 1));
      if (data && typeof data === 'object' && ('components' in data || 'nodes' in data)) return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError ? `JSON inválido: ${(lastError as Error).message}` : 'não encontrei um circuito (JSON com "components") no texto');
}
