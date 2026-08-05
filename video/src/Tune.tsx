import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { colors } from './theme';
import { sans } from './fonts';
import { Card, Row, SectionLabel, Segmented } from './components/Settings';
import { FieldHead, Slider, Toggle } from './components/Controls';

const rows: [string, string][] = [
  ['Model', 'Gemma 4 E2B (INT4)'],
  ['Engine', 'MLX Swift'],
  ['Parameters', '~2.5B effective'],
  ['Quantization', '4-bit'],
  ['Context', '128K tokens'],
];

const rowSpring = (frame: number, fps: number, delay: number) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.55 } });
  return { opacity: interpolate(s, [0, 1], [0, 1]), translate: (1 - s) * 16 };
};

export const Tune: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  // Hand-tuned against a still render: the full list (through the
  // Generation card) very nearly fills the 1391px frame on its own, so
  // this is a gentle settle rather than a reveal of clipped content.
  const scroll = interpolate(frame, [100, 165], [0, 170], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const visionSlide = interpolate(frame, [178, 204], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const videoSlide = interpolate(frame, [214, 246], [0, 2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const thinkingOn = interpolate(frame, [256, 272], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const tempPos = interpolate(frame, [284, 314], [0.65, 0.34], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: sans }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '26px 24px 18px',
          opacity: headerIn,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.fg }}>Settings</span>
        <div
          style={{
            position: 'absolute',
            right: 22,
            background: colors.pill,
            borderRadius: 20,
            padding: '9px 20px',
            fontSize: 16,
            fontWeight: 600,
            color: colors.fg,
          }}
        >
          Done
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -scroll, left: 0, right: 0, padding: '10px 24px 0' }}>
          <SectionLabel>Model Info</SectionLabel>
          <Card style={{ marginBottom: 34 }}>
            {rows.map(([label, value], i) => {
              const { opacity, translate } = rowSpring(frame, fps, 16 + i * 7);
              return (
                <div key={label} style={{ opacity, transform: `translateY(${translate}px)` }}>
                  <Row label={label} value={value} last={i === rows.length - 1} />
                </div>
              );
            })}
          </Card>

          <SectionLabel>Theme &amp; Visuals</SectionLabel>
          <Card style={{ marginBottom: 34 }}>
            <Row label="Accent Color" value="Mono" />
            <Row label="Background Color" value="Black" last />
          </Card>

          <SectionLabel>Vision Quality</SectionLabel>
          <Card style={{ marginBottom: 14 }}>
            <Segmented options={['High', 'Maximum']} activeIndex={0} slidePos={visionSlide} />
          </Card>
          <div style={{ fontSize: 14, color: colors.fg3, padding: '0 8px 34px', lineHeight: 1.5 }}>
            Higher quality lets the model see images at a finer resolution, using more memory.
          </div>

          <SectionLabel>Video Analysis</SectionLabel>
          <Card style={{ marginBottom: 34 }}>
            <Segmented options={['Light', 'Balanced', 'Deep', 'Custom']} activeIndex={0} slidePos={videoSlide} />
          </Card>

          <SectionLabel>Generation</SectionLabel>
          <Card>
            <div style={{ position: 'relative' }}>
              <FieldHead label="Thinking Mode" sub="Runs multiple rounds of reasoning & verification before answering." />
              <Toggle on={thinkingOn} />
            </div>
            <FieldHead label="Temperature" value={tempPos.toFixed(2)} sub="Controls creativity. Higher = more random, lower = more focused." last />
            <Slider pos={tempPos} />
          </Card>
        </div>
      </div>
    </AbsoluteFill>
  );
};
