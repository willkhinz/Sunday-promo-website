import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

type Sprite = { src: string; x: number; y: number; w: number; h: number };
type Line = { top: number; bottom: number; left: number; right: number };

export type PlateSpec = {
  width: number;
  height: number;
  plate: string;
  fillColor: string;
  user: Sprite;
  usertime: Sprite;
  asst: Sprite;
  asstmeta: Sprite;
  /** the bubble's own edges within its padded sprite */
  bubble: { left: number; top: number; right: number; bottom: number };
  lines: Line[];
};

const at = (s: Sprite): React.CSSProperties => ({
  position: 'absolute',
  left: s.x,
  top: s.y,
  width: s.w,
  height: s.h,
});

/**
 * Every pixel here comes out of the real App Store capture. The plate is
 * that capture with the two message bubbles painted out; the bubbles
 * themselves are cropped from the same file and animated back in over it,
 * so the status bar, nav bar, composer, type, and bubble geometry are the
 * app's own rather than a reconstruction of it.
 */
export const ChatPlate: React.FC<{
  spec: PlateSpec;
  askAt: number;
  streamAt: number;
  framesPerLine: number;
}> = ({ spec, askAt, streamAt, framesPerLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { user, usertime, asst, asstmeta, lines, bubble } = spec;

  const askIn = spring({ frame: frame - askAt, fps, config: { damping: 18, mass: 0.5 } });
  const askFade = interpolate(frame - askAt, [0, 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const timeFade = interpolate(frame - askAt, [14, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The answer arrives a line at a time, each line wiped left-to-right, so
  // the reveal lands on the capture's own line breaks and never cuts a row
  // of text through the middle.
  const elapsed = frame - streamAt;
  const started = elapsed >= 0;
  const progress = Math.max(0, elapsed) / framesPerLine;
  const index = Math.min(Math.floor(progress), lines.length - 1);
  const withinLine = Math.min(1, progress - index);
  const done = progress >= lines.length;

  const line = lines[index];
  const lastBottom = lines[lines.length - 1].bottom;
  // Everything below the last line — the bubble's bottom padding, its
  // rounded corners, and the sprite's own margin — travels with the bubble
  // as it grows, so the tail is always the capture's real pixels.
  const capH = asst.h - lastBottom;
  // Cut into the gap below the line rather than exactly at its baseline box,
  // or a row of the next line's antialiasing survives the crop.
  const capTop = Math.min(line.bottom + (done ? 0 : 3), lastBottom);
  const bubbleH = capTop + capH;

  // Wipe across the current line's own ink extent, eased so each line
  // starts and settles rather than running at a constant crawl.
  const wipeX = interpolate(
    Easing.out(Easing.quad)(withinLine),
    [0, 1],
    [line.left, line.right + 2]
  );

  const metaFade = interpolate(
    elapsed,
    [lines.length * framesPerLine + 2, lines.length * framesPerLine + 14],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img
        src={staticFile(spec.plate)}
        style={{ position: 'absolute', left: 0, top: 0, width: spec.width, height: spec.height }}
      />

      <div
        style={{
          ...at(user),
          opacity: askFade,
          transform: `translateY(${(1 - askIn) * 14}px) scale(${0.965 + askIn * 0.035})`,
          transformOrigin: '100% 100%',
        }}
      >
        <Img src={staticFile(user.src)} style={{ width: user.w, height: user.h }} />
      </div>

      <div style={{ ...at(usertime), opacity: timeFade }}>
        <Img src={staticFile(usertime.src)} style={{ width: usertime.w, height: usertime.h }} />
      </div>

      {started && (
        <div style={{ position: 'absolute', left: asst.x, top: asst.y, width: asst.w, height: bubbleH }}>
          {/* the bubble down to the last revealed line */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: asst.w, height: capTop, overflow: 'hidden' }}>
            <Img
              src={staticFile(asst.src)}
              style={{ position: 'absolute', top: 0, left: 0, width: asst.w, height: asst.h }}
            />
          </div>

          {/* the rest of the line in progress, hidden under the bubble's own
              fill — clamped to the bubble's edge so it never paints past it */}
          {!done && (
            <div
              style={{
                position: 'absolute',
                left: wipeX,
                top: line.top,
                width: bubble.right - wipeX,
                height: line.bottom - line.top + 1,
                background: spec.fillColor,
              }}
            />
          )}

          {/* the capture's real bottom padding and rounded corners, kept
              flush with the bubble as it grows */}
          <div style={{ position: 'absolute', top: capTop, left: 0, width: asst.w, height: capH, overflow: 'hidden' }}>
            <Img
              src={staticFile(asst.src)}
              style={{ position: 'absolute', top: -(asst.h - capH), left: 0, width: asst.w, height: asst.h }}
            />
          </div>
        </div>
      )}

      <div style={{ ...at(asstmeta), opacity: metaFade }}>
        <Img src={staticFile(asstmeta.src)} style={{ width: asstmeta.w, height: asstmeta.h }} />
      </div>
    </AbsoluteFill>
  );
};
