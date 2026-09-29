import type { Edge, Node } from '@xyflow/react';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export interface Pin {
  id: string;
  name: string;
}

/** top/bottom: ordem da esquerda p/ direita. left/right: ordem de cima p/ baixo. */
export type PinMap = Record<Side, Pin[]>;

export type ComponentData = {
  label: string;
  color: string;
  pins: PinMap;
};

export type NoteData = {
  text: string;
};

export type ComponentNodeT = Node<ComponentData, 'component'>;
/** Ponto de fio: ponta solta (1 fio), dobra (2 fios) ou junção (3+ fios). */
export type PointNodeT = Node<Record<string, never>, 'point'>;
export type NoteNodeT = Node<NoteData, 'note'>;
export type AppNode = ComponentNodeT | PointNodeT | NoteNodeT;

export type WireData = {
  color: string;
};
export type WireEdgeT = Edge<WireData, 'wire'>;

export interface Template {
  id: string;
  label: string;
  color: string;
  pins: Record<Side, string[]>;
  width?: number;
  height?: number;
}

export type Tool = 'select' | 'join' | 'cut';
export type WireStyle = 'curvy' | 'straight' | 'step';

export type EditorState =
  | { mode: 'new' }
  | { mode: 'node'; nodeId: string }
  | { mode: 'template'; templateId: string }
  | null;
