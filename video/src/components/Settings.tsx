import React from 'react';
import { colors } from '../theme';
import { sans, monospace } from '../fonts';

export const SectionLabel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      fontFamily: sans,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 0.6,
      color: colors.fg3,
      textTransform: 'uppercase',
      padding: '0 8px 10px',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: colors.bubbleAssistant,
      borderRadius: 18,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Row: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 22px',
      borderBottom: last ? 'none' : `1px solid ${colors.line}`,
      fontFamily: sans,
    }}
  >
    <span style={{ fontSize: 18, color: colors.fg }}>{label}</span>
    <span style={{ fontSize: 17, color: colors.fg2, fontFamily: monospace }}>{value}</span>
  </div>
);

export const Segmented: React.FC<{ options: string[]; activeIndex: number; slidePos: number }> = ({
  options,
  slidePos,
}) => {
  const n = options.length;
  return (
    <div style={{ position: 'relative', display: 'flex', padding: 5, fontFamily: sans }}>
      <div
        style={{
          position: 'absolute',
          top: 5,
          bottom: 5,
          left: `calc(${(100 / n) * slidePos}% + 5px)`,
          width: `calc(${100 / n}% - 10px)`,
          background: 'rgba(255,255,255,0.16)',
          borderRadius: 12,
        }}
      />
      {options.map((opt, i) => (
        <div
          key={opt}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '11px 4px',
            fontSize: 16,
            fontWeight: 600,
            color: Math.round(slidePos) === i ? colors.fg : colors.fg2,
            zIndex: 1,
          }}
        >
          {opt}
        </div>
      ))}
    </div>
  );
};
