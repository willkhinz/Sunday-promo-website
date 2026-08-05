import React from 'react';
import { colors } from '../theme';
import { sans } from '../fonts';

export const NavBar: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 22px 0',
        fontFamily: sans,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: colors.pill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="12" height="20" viewBox="0 0 12 20">
          <path fill={colors.fg} d="M10.5 1 1 10l9.5 9" stroke={colors.fg} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 21,
            fontWeight: 700,
            color: colors.fg,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <svg width="14" height="9" viewBox="0 0 14 9" style={{ flexShrink: 0 }}>
          <path d="M1 1l6 6 6-6" stroke={colors.fg2} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: colors.pill,
          borderRadius: 22,
          padding: '9px 16px',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke={colors.fg2} strokeWidth="1.6" />
          {[4, 8, 12, 16, 20].map((v) => (
            <React.Fragment key={v}>
              <line x1={v} y1="2" x2={v} y2="6" stroke={colors.fg2} strokeWidth="1.4" />
              <line x1={v} y1="18" x2={v} y2="22" stroke={colors.fg2} strokeWidth="1.4" />
            </React.Fragment>
          ))}
        </svg>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke={colors.fg2}
            strokeWidth="1.5"
            strokeLinejoin="round"
            d="M12 3c-3 0-5 2-5 4.5 0 1.4.6 2.3 1.4 3-1 .6-1.7 1.7-1.7 3 0 1.9 1.5 3.2 3 3.4.3 1.2 1.4 2.1 2.6 2.1h.4c1.2 0 2.3-.9 2.6-2.1 1.5-.2 3-1.5 3-3.4 0-1.3-.7-2.4-1.7-3 .8-.7 1.4-1.6 1.4-3C17.9 5 15.9 3 12.9 3H12Z"
          />
        </svg>
      </div>
    </div>
  );
};
