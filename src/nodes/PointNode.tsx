import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { useAppStore } from '../store';
import type { PointNodeT } from '../types';
import { POINT_HANDLE } from '../utils';

/**
 * Ponto de fio. A aparência depende de quantos fios chegam nele:
 * 1 = ponta solta (anel), 2 = dobra (pontinho), 3+ = junção (bolinha cheia).
 * Arrastar a borda move o ponto; arrastar o centro puxa um fio novo a partir dele.
 */
function PointNodeImpl({ id, selected }: NodeProps<PointNodeT>) {
  const info = useAppStore(
    useCallback(
      (s) => {
        let deg = 0;
        let color = '';
        for (const e of s.edges) {
          if (e.source === id || e.target === id) {
            deg++;
            if (!color) color = e.data?.color ?? '';
          }
        }
        return `${deg}|${color}`;
      },
      [id],
    ),
  );
  const [degStr, color] = info.split('|');
  const deg = Number(degStr);
  const kind = deg <= 1 ? 'end' : deg === 2 ? 'bend' : 'junction';

  return (
    <div
      className={`point point-${kind}${selected ? ' selected' : ''}`}
      style={{ ['--c' as string]: color || '#868e96' }}
      title={kind === 'end' ? 'Ponta solta — arraste até um pino para ligar' : undefined}
    >
      <div className="point-vis" />
      <Handle id={POINT_HANDLE} type="source" position={Position.Top} className="point-handle" />
    </div>
  );
}

export const PointNode = memo(PointNodeImpl);
