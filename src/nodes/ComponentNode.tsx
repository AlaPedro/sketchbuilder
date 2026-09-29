import { Handle, NodeResizer, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import type { ComponentNodeT } from '../types';
import { SIDES } from '../types';
import { SIDE_POSITION } from '../utils';
import { ComponentBody } from './ComponentBody';

function ComponentNodeImpl({ id, data, selected, width, height }: NodeProps<ComponentNodeT>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const commit = useAppStore((s) => s.commit);

  const connectedKey = useAppStore(
    useCallback(
      (s) => {
        const ids: string[] = [];
        for (const e of s.edges) {
          if (e.source === id && e.sourceHandle) ids.push(e.sourceHandle);
          if (e.target === id && e.targetHandle) ids.push(e.targetHandle);
        }
        return ids.sort().join('|');
      },
      [id],
    ),
  );
  const connected = useMemo(() => new Set(connectedKey.split('|')), [connectedKey]);

  const pinSignature = SIDES.map((s) => data.pins[s].map((p) => p.id).join(',')).join('/');
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, pinSignature, width, height, updateNodeInternals]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        color="#6965db"
        onResizeStart={commit}
      />
      <ComponentBody
        label={data.label}
        color={data.color}
        pins={data.pins}
        connected={connected}
        renderTip={(side, pin, style) => (
          <Handle
            id={pin.id}
            type="source"
            position={SIDE_POSITION[side]}
            className="pin-handle"
            style={style}
            title={`${data.label} · ${pin.name}`}
          />
        )}
      />
    </>
  );
}

export const ComponentNode = memo(ComponentNodeImpl);
