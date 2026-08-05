import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors } from '../theme';
import { sans } from '../fonts';
import { StatusBar } from './StatusBar';
import { NavBar } from './NavBar';
import { Composer } from './Composer';

export const ChatDemo: React.FC<{
  query: string;
  navTitle: string;
  answer: string;
  airplaneIntro?: boolean;
  topGap: number;
}> = ({ query, navTitle, answer, airplaneIntro, topGap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Airplane-mode beat only plays in the "answer" clip: wifi -> airplane,
  // then the question appears with no loading spinner in between.
  const airplane = airplaneIntro
    ? interpolate(frame, [0, 18, 30], [0, 0, 1], { extrapolateRight: 'clamp' })
    : 0;
  const introOffset = airplaneIntro ? 34 : 0;

  const bubbleIn = spring({
    frame: frame - introOffset,
    fps,
    config: { damping: 16, mass: 0.6 },
  });
  const bubbleOpacity = interpolate(frame - introOffset, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const answerStart = introOffset + 20;
  const words = answer.split(' ');
  const wordsPerSecond = 11;
  const revealedCount = Math.max(
    0,
    Math.floor(((frame - answerStart) / fps) * wordsPerSecond)
  );
  const visibleAnswer = words.slice(0, Math.min(revealedCount, words.length)).join(' ');
  const answerVisible = frame >= answerStart;
  const answerCardIn = spring({ frame: frame - answerStart, fps, config: { damping: 18, mass: 0.5 } });

  const caretOn = revealedCount < words.length && Math.floor(frame / 8) % 2 === 0;

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: sans }}>
      <StatusBar time="1:50" airplane={airplane} />
      <NavBar title={navTitle} />

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 22px', gap: 14 }}>
        <div style={{ height: topGap }} />

        <div
          style={{
            alignSelf: 'flex-end',
            maxWidth: '78%',
            background: colors.bubbleUser,
            color: colors.textOnUser,
            borderRadius: 22,
            padding: '15px 20px',
            fontSize: 19,
            lineHeight: 1.35,
            opacity: bubbleOpacity,
            transform: `translateY(${(1 - bubbleIn) * 18}px)`,
          }}
        >
          {query}
        </div>

        {answerVisible && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '86%',
              background: colors.bubbleAssistant,
              color: colors.fg,
              borderRadius: 22,
              padding: '17px 20px',
              fontSize: 18,
              lineHeight: 1.45,
              opacity: interpolate(answerCardIn, [0, 1], [0, 1]),
              transform: `translateY(${(1 - answerCardIn) * 12}px)`,
              marginBottom: 40,
            }}
          >
            {visibleAnswer}
            {caretOn && (
              <span style={{ display: 'inline-block', width: 9, height: 19, background: colors.fg, marginLeft: 2, verticalAlign: '-3px', borderRadius: 1 }} />
            )}
          </div>
        )}
      </div>

      <Composer />
    </AbsoluteFill>
  );
};
