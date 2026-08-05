import React from 'react';
import { colors } from '../theme';
import { sans } from '../fonts';

const IconBtn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 44,
      height: 44,
      borderRadius: 22,
      background: colors.pill,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

export const Composer: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px 30px', fontFamily: sans }}>
      <IconBtn>
        <svg width="19" height="19" viewBox="0 0 24 24">
          <rect x="2.5" y="4" width="19" height="16" rx="3" fill="none" stroke={colors.fg} strokeWidth="1.6" />
          <circle cx="8.5" cy="10" r="1.8" fill={colors.fg} />
          <path d="M3 17.5 9 12l4 4 3.5-3.5L21 17" fill="none" stroke={colors.fg} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </IconBtn>
      <IconBtn>
        <svg width="16" height="19" viewBox="0 0 16 19">
          <rect x="4" y="1" width="8" height="12" rx="4" fill="none" stroke={colors.fg} strokeWidth="1.6" />
          <path d="M1 9.5a7 7 0 0 0 14 0M8 16.5V18.5M4.5 18.5h7" fill="none" stroke={colors.fg} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </IconBtn>
      <IconBtn>
        <svg width="18" height="19" viewBox="0 0 18 19">
          <path
            d="M15.5 8.6 8.2 15.9a3.6 3.6 0 0 1-5-5l7-7a2.4 2.4 0 0 1 3.4 3.4l-6.7 6.7a1.1 1.1 0 0 1-1.6-1.6l6-6"
            fill="none"
            stroke={colors.fg}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconBtn>

      <div
        style={{
          flex: 1,
          height: 44,
          borderRadius: 22,
          background: 'rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <span style={{ color: colors.fg3, fontSize: 17 }}>Message</span>
      </div>

      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: colors.bubbleUser,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="18" viewBox="0 0 16 18">
          <path d="M8 17V1M1.5 7.5 8 1l6.5 6.5" fill="none" stroke={colors.textOnUser} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};
