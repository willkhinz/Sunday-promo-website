#!/usr/bin/env python3
"""Take the App Store captures apart into plates and sprites.

Each clip animates the real capture rather than a redrawing of it, so the
only thing this has to produce is (a) the capture with the moving parts
lifted off it, and (b) those parts on their own. Everything is measured off
the pixels rather than hard-coded, apart from the region boxes below.

Writes video/public/plates/*.png and video/src/plates.json. Needs Pillow.
"""

import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG = os.path.join(ROOT, 'assets', 'img')
OUT = os.path.join(ROOT, 'video', 'public', 'plates')
MANIFEST = os.path.join(ROOT, 'video', 'src', 'plates.json')

# The assistant bubble's fill, and the page behind it. Both screens are pure
# black underneath, which is why painting a region out is lossless here.
FILL = (20, 20, 20)
BG = (0, 0, 0)

# A few pixels of margin on every sprite so it carries its own anti-aliased
# outline; the margin is background, so it composites over the plate
# invisibly. Erase boxes are looser still, for the same reason in reverse.
PAD = 3


def is_fill(c):
    return all(abs(c[i] - FILL[i]) <= 6 for i in range(3))


CHATS = {
    'hero': dict(
        src='chat-hero',
        sprite=dict(user=(169, 264, 621, 325), usertime=(555, 335, 613, 348),
                    asst=(77, 369, 532, 772), asstmeta=(14, 748, 210, 804)),
        erase=[(160, 256, 630, 358), (10, 363, 540, 808)],
    ),
    'answer': dict(
        src='chat',
        sprite=dict(user=(171, 596, 621, 658), usertime=(555, 667, 613, 680),
                    asst=(77, 702, 531, 1104), asstmeta=(14, 1080, 210, 1136)),
        erase=[(160, 588, 630, 690), (10, 696, 540, 1140)],
    ),
}

# Settings sections, each a label plus the card it introduces, read off the
# capture's content bands. The status bar and Settings/Done header stay put.
TUNE = dict(
    src='settings-model',
    groups=[(20, 222, 622, 682), (20, 718, 622, 930),
            (20, 962, 622, 1246), (20, 1262, 622, 1391)],
)


def text_lines(px, box):
    """Rows of ink inside the bubble, so the reveal can step line by line."""
    x0, y0, x1, y1 = box
    out, run = [], None
    for y in range(y0, y1):
        ink = [x for x in range(x0, x1)
               if not is_fill(px[x, y]) and sum(px[x, y]) / 3 > 30]
        if ink:
            if run is None:
                run = [y, y, min(ink), max(ink)]
            else:
                run[1] = y
                run[2] = min(run[2], min(ink))
                run[3] = max(run[3], max(ink))
        else:
            if run and run[1] - run[0] >= 4:
                out.append(run)
            run = None
    if run and run[1] - run[0] >= 4:
        out.append(run)
    return out


def paint_out(image, boxes):
    px = image.load()
    for x0, y0, x1, y1 in boxes:
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = BG


def build_chat(key, spec):
    im = Image.open(os.path.join(IMG, spec['src'] + '.webp')).convert('RGB')
    W, H = im.size
    ax0, ay0, ax1, ay1 = spec['sprite']['asst']
    lines = text_lines(im.load(), spec['sprite']['asst'])

    boxes = {}
    for part, (x0, y0, x1, y1) in spec['sprite'].items():
        box = (max(0, x0 - PAD), max(0, y0 - PAD), min(W, x1 + PAD), min(H, y1 + PAD))
        boxes[part] = box
        im.crop(box).save(os.path.join(OUT, f'{key}-{part}.png'))

    plate = im.copy()
    paint_out(plate, spec['erase'])
    plate.save(os.path.join(OUT, f'{key}-plate.png'))

    def rec(part):
        x0, y0, x1, y1 = boxes[part]
        return dict(src=f'plates/{key}-{part}.png', x=x0, y=y0, w=x1 - x0, h=y1 - y0)

    sx, sy = boxes['asst'][0], boxes['asst'][1]
    print(f'{key}: {len(lines)} lines, bubble {ax1 - ax0}x{ay1 - ay0}')
    return dict(
        width=W, height=H, plate=f'plates/{key}-plate.png',
        fillColor='rgb({},{},{})'.format(*FILL),
        user=rec('user'), usertime=rec('usertime'),
        asst=rec('asst'), asstmeta=rec('asstmeta'),
        bubble=dict(left=ax0 - sx, top=ay0 - sy, right=ax1 - sx, bottom=ay1 - sy),
        lines=[dict(top=a - sy, bottom=b - sy, left=lx - sx, right=rx - sx)
               for a, b, lx, rx in lines],
    )


def build_tune():
    im = Image.open(os.path.join(IMG, TUNE['src'] + '.webp')).convert('RGB')
    W, H = im.size
    groups = []
    for i, (x0, y0, x1, y1) in enumerate(TUNE['groups']):
        im.crop((x0, y0, x1, y1)).save(os.path.join(OUT, f'tune-g{i}.png'))
        groups.append(dict(src=f'plates/tune-g{i}.png', x=x0, y=y0, w=x1 - x0, h=y1 - y0))

    plate = im.copy()
    paint_out(plate, TUNE['groups'])
    plate.save(os.path.join(OUT, 'tune-plate.png'))
    print(f'tune: {len(groups)} sections')
    return dict(width=W, height=H, plate='plates/tune-plate.png', groups=groups)


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {k: build_chat(k, v) for k, v in CHATS.items()}
    manifest['tune'] = build_tune()
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    print('wrote', os.path.relpath(MANIFEST, ROOT))


if __name__ == '__main__':
    main()
