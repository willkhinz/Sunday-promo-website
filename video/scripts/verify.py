#!/usr/bin/env python3
"""Check each clip's last frame against the capture it was built from.

The whole point of the plate approach is that the animation resolves to the
real screenshot. If a sprite box or a coordinate drifts, this catches it.
Renders the final frame of every composition and diffs it against the
source capture. Needs Pillow and a working `remotion still`.
"""

import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VIDEO = os.path.join(ROOT, 'video')

# composition -> (capture, last frame index)
CLIPS = {
    'hero': ('chat-hero', 254),
    'answer': ('chat', 284),
    'tune': ('settings-model', 179),
}

TOLERANCE = 24  # per-channel; absorbs webp decode and jpeg-frame rounding


def main():
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for comp, (capture, frame) in CLIPS.items():
            shot = os.path.join(tmp, f'{comp}.png')
            subprocess.run(
                ['npx', 'remotion', 'still', 'src/index.ts', comp, shot, f'--frame={frame}'],
                cwd=VIDEO, check=True, stdout=subprocess.DEVNULL,
            )
            got = Image.open(shot).convert('RGB')
            want = Image.open(
                os.path.join(ROOT, 'assets', 'img', capture + '.webp')
            ).convert('RGB').crop((0, 0, *got.size))

            px = ImageChops.difference(got, want).load()
            w, h = got.size
            off = sum(1 for y in range(h) for x in range(w) if max(px[x, y]) > TOLERANCE)
            status = 'ok' if off == 0 else f'FAIL ({off} px)'
            print(f'{comp:<8} {got.size[0]}x{got.size[1]}  vs {capture}.webp  {status}')
            failures += off > 0

    if failures:
        print(f'\n{failures} clip(s) do not settle on their capture')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
