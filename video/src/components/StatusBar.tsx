import React from 'react';
import { colors } from '../theme';
import { sans } from '../fonts';

export const StatusBar: React.FC<{ time: string; airplane: number }> = ({ time, airplane }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 26px 0',
        fontFamily: sans,
        color: colors.fg,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 0.2 }}>{time}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* airplane icon fades in / cellular+wifi fade out as `airplane` goes 0 -> 1 */}
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          style={{ opacity: airplane, transform: `scale(${0.7 + airplane * 0.3})` }}
        >
          <path
            fill={colors.fg}
            d="M22 16.5v-2l-8.5-5V4.5c0-1.1-.9-2-1.5-2s-1.5.9-1.5 2v5l-8.5 5v2l8.5-2.6V19l-2.5 1.8V22l4-1 4 1v-1.2L14 19v-5.1l8 2.6z"
          />
        </svg>

        <div style={{ display: 'flex', gap: 3, opacity: 1 - airplane }}>
          {[6, 9, 12, 15].map((h, i) => (
            <div
              key={i}
              style={{
                width: 3.4,
                height: h,
                borderRadius: 1,
                background: i < 1 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.35)',
                alignSelf: 'flex-end',
              }}
            />
          ))}
        </div>

        <svg width="19" height="14" viewBox="0 0 20 14" style={{ opacity: 1 - airplane }}>
          <path
            fill={colors.fg}
            d="M10 13.2 1.4 5.6a12.6 12.6 0 0 1 17.2 0L10 13.2Zm0-3.4L5.1 5.5a6.4 6.4 0 0 1 9.8 0L10 9.8Zm0-3.4L8.3 4.9a2 2 0 0 1 3.4 0L10 6.4Z"
          />
        </svg>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: colors.battery,
            borderRadius: 5,
            padding: '2px 5px',
            opacity: 1 - airplane * 0.4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#04220c' }}>
            {airplane > 0.5 ? '—' : '39'}
          </span>
          {airplane <= 0.5 && (
            <svg width="9" height="12" viewBox="0 0 9 12">
              <path fill="#04220c" d="M5 0 0 7h3l-1 5 5-7H4l1-5Z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
