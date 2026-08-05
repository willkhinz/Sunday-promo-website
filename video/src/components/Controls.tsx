import React from 'react';
import { colors } from '../theme';
import { sans } from '../fonts';

export const FieldHead: React.FC<{ label: string; value?: string; sub: string; last?: boolean }> = ({
  label,
  value,
  sub,
  last,
}) => (
  <div style={{ padding: '18px 22px', borderBottom: last ? 'none' : `1px solid ${colors.line}`, fontFamily: sans }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 18, color: colors.fg }}>{label}</span>
      {value !== undefined && <span style={{ fontSize: 18, color: colors.fg }}>{value}</span>}
    </div>
    <div style={{ fontSize: 13.5, color: colors.fg3, marginTop: 4, lineHeight: 1.4, maxWidth: value === undefined ? '80%' : '100%' }}>
      {sub}
    </div>
  </div>
);

export const Toggle: React.FC<{ on: number }> = ({ on }) => (
  <div
    style={{
      position: 'absolute',
      top: 18,
      right: 22,
      width: 51,
      height: 31,
      borderRadius: 16,
      background: `rgba(255,255,255,${0.14 + on * 0.86 - 0.14 * on})`,
      backgroundColor: on > 0.5 ? '#ffffff' : 'rgba(120,120,128,0.4)',
      transition: 'none',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: 2 + on * 20,
        width: 27,
        height: 27,
        borderRadius: 14,
        background: on > 0.5 ? '#000' : '#fff',
      }}
    />
  </div>
);

export const Slider: React.FC<{ pos: number }> = ({ pos }) => (
  <div style={{ padding: '10px 22px 20px', position: 'relative' }}>
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(120,120,128,0.4)', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pos * 100}%`, borderRadius: 3, background: '#fff' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${pos * 100}%`,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: '#fff',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  </div>
);
