import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Position,
} from '@xyflow/react';
import { memo } from 'react';
import { useAppStore } from '../store';
import type { AppNode, WireEdgeT } from '../types';
import { inferPosition, isLightColor } from '../utils';

const center = (n: InternalNode<AppNode>) => ({
  x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
  y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
});

function WireEdgeImpl(props: EdgeProps<WireEdgeT>) {
  const { id, source, target, data, selected } = props;
  const sNode = useInternalNode<AppNode>(source);
  const tNode = useInternalNode<AppNode>(target);
  const wireStyle = useAppStore((s) => s.wireStyle);
  const inNet = useAppStore((s) => s.net.has(id));

  let { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = props;
  let sp: Position = props.sourcePosition;
  let tp: Position = props.targetPosition;
  // Pontos de fio: o fio encaixa no centro e a direção é deduzida da outra ponta.
  const sIsPoint = sNode?.type === 'point';
  const tIsPoint = tNode?.type === 'point';
  if (sIsPoint && sNode) ({ x: sx, y: sy } = center(sNode));
  if (tIsPoint && tNode) ({ x: tx, y: ty } = center(tNode));
  if (sIsPoint) sp = inferPosition(sx, sy, tx, ty);
  if (tIsPoint) tp = inferPosition(tx, ty, sx, sy);

  const args = { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition: sp, targetPosition: tp };
  const [path] =
    wireStyle === 'straight'
      ? getStraightPath(args)
      : wireStyle === 'step'
        ? getSmoothStepPath({ ...args, borderRadius: 6, offset: 14 })
        : getBezierPath({ ...args, curvature: 0.35 });

  const color = data?.color ?? '#1e1e1e';
  const width = selected ? 3.5 : 2.5;

  return (
    <>
      {(selected || inNet) && (
        <path d={path} fill="none" stroke={color} strokeOpacity={selected ? 0.28 : 0.16} strokeWidth={selected ? 11 : 9} strokeLinecap="round" />
      )}
      {isLightColor(color) && (
        <path d={path} fill="none" stroke="#495057" strokeWidth={width + 2} strokeLinecap="round" />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        style={{ stroke: color, strokeWidth: width, strokeLinecap: 'round' }}
      />
    </>
  );
}

export const WireEdge = memo(WireEdgeImpl);
