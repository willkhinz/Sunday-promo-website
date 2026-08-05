import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import plates from './plates.json';

const spec = plates.tune;

/**
 * The settings capture, sliced along its own section boundaries and dealt
 * back in. Nothing here is redrawn — the plate is the real screen with the
 * sections lifted off it, and each section is a crop of the same file, so
 * the clip settles on the capture pixel for pixel.
 */
export const Tune: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img
        src={staticFile(spec.plate)}
        style={{ position: 'absolute', left: 0, top: 0, width: spec.width, height: spec.height }}
      />

      {spec.groups.map((g, i) => {
        const delay = 10 + i * 11;
        const s = spring({ frame: frame - delay, fps, config: { damping: 20, mass: 0.7 } });
        const fade = interpolate(frame - delay, [0, 12], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={g.src}
            style={{
              position: 'absolute',
              left: g.x,
              top: g.y,
              width: g.w,
              height: g.h,
              opacity: fade,
              transform: `translateY(${(1 - s) * 26}px)`,
            }}
          >
            <Img src={staticFile(g.src)} style={{ width: g.w, height: g.h }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
