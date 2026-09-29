import type { NodeProps } from '@xyflow/react';
import { memo, useState } from 'react';
import { useAppStore } from '../store';
import type { NoteNodeT } from '../types';

function NoteNodeImpl({ id, data, selected }: NodeProps<NoteNodeT>) {
  const [editing, setEditing] = useState(false);
  const updateNote = useAppStore((s) => s.updateNote);

  return (
    <div className={`note${selected ? ' selected' : ''}`} onDoubleClick={() => setEditing(true)}>
      {editing ? (
        <textarea
          className="nodrag nowheel"
          autoFocus
          defaultValue={data.text}
          rows={Math.max(1, data.text.split('\n').length)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            if (e.currentTarget.value !== data.text) updateNote(id, e.currentTarget.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) e.currentTarget.blur();
          }}
        />
      ) : (
        <div className="note-text">{data.text || ' '}</div>
      )}
    </div>
  );
}

export const NoteNode = memo(NoteNodeImpl);
