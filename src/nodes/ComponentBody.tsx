import type { CSSProperties, ReactNode } from 'react';
import type { Pin, PinMap, Side } from '../types';
import { SIDES } from '../types';
import { STUB, pinPct } from '../utils';

/** Posição da ponta do pino (onde o fio encaixa), relativa ao retângulo. */
export function tipStyle(side: Side, pct: number): CSSProperties {
  switch (side) {
    case 'top':
      return { left: `${pct}%`, top: -STUB };
    case 'bottom':
      return { left: `${pct}%`, top: 'auto', bottom: -STUB };
    case 'left':
      return { top: `${pct}%`, left: -STUB };
    case 'right':
      return { top: `${pct}%`, left: 'auto', right: -STUB };
  }
}

function stubStyle(side: Side, pct: number): CSSProperties {
  const horizontal = side === 'left' || side === 'right';
  return horizontal
    ? { top: `${pct}%`, [side]: -STUB, width: STUB, height: 2 }
    : { left: `${pct}%`, [side]: -STUB, height: STUB, width: 2 };
}

interface Props {
  label: string;
  color: string;
  pins: PinMap;
  connected?: Set<string>;
  renderTip?: (side: Side, pin: Pin, style: CSSProperties) => ReactNode;
}

export function ComponentBody({ label, color, pins, connected, renderTip }: Props) {
  return (
    <div className="comp" style={{ background: color }}>
      <div className="comp-label">{label}</div>
      {SIDES.map((side) =>
        pins[side].map((pin, i) => {
          const pct = pinPct(i, pins[side].length);
          return (
            <div key={pin.id} className={connected?.has(pin.id) ? 'pin is-connected' : 'pin'}>
              <div className={`pin-stub pin-stub-${side}`} style={stubStyle(side, pct)} />
              <span
                className={`pin-label pin-label-${side}`}
                style={side === 'top' || side === 'bottom' ? { left: `${pct}%` } : { top: `${pct}%` }}
              >
                {pin.name}
              </span>
              {renderTip?.(side, pin, tipStyle(side, pct))}
            </div>
          );
        }),
      )}
    </div>
  );
}
