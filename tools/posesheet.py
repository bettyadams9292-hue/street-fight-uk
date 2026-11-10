"""Draws stick-figure sheets from tools/*.ts JSON: python3 tools/posesheet.py in.json out.png [cols]"""
import json, sys, math
from PIL import Image, ImageDraw
frames = json.load(open(sys.argv[1])); out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
CW, CH, S = 300, 250, 105
rows = math.ceil(len(frames) / cols)
img = Image.new('RGB', (cols * CW, rows * CH), (24, 26, 32)); d = ImageDraw.Draw(img)
def draw(b, ox, oy, view, pitch, f):
    def P(v):
        x, y, z = v
        if pitch:  # whole-body pitch about the feet (x axis)
            c, s = math.cos(pitch), math.sin(pitch); y, z = y * c - z * s, y * s + z * c
            y += 0.12 * min(1, abs(pitch) / 1.57)
        h = z if view == 'side' else x
        return (ox + h * S, oy - y * S)
    d.line([(ox - 60, oy), (ox + 60, oy)], fill=(70, 70, 80), width=1)
    def seg(a, b_, col, w=7): d.line([P(a), P(b_)], fill=col, width=w)
    order = ['r', 'l'] if view == 'side' else ['r', 'l']
    cols_ = {'l': ((235, 190, 90), (240, 120, 80)), 'r': ((120, 150, 200), (90, 110, 170))}
    def limb(s):
        seg(b['hipJoint'][s], b['knee'][s], cols_[s][1]); seg(b['knee'][s], b['ankle'][s], cols_[s][1], 6)
        ft = f.get('foot' + s.upper())
        if ft: seg(b['ankle'][s], ft[0:3], cols_[s][1], 5); seg(b['ankle'][s], ft[3:6], cols_[s][1], 5)
    def arm(s):
        seg(b['shoulder'][s], b['elbow'][s], cols_[s][0], 6); seg(b['elbow'][s], b['hand'][s], cols_[s][0], 5)
        x, y = P(b['hand'][s]); d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=cols_[s][0])
    limb('r'); arm('r')
    mid = [(b['shoulder']['l'][i] + b['shoulder']['r'][i]) / 2 for i in range(3)]
    seg(b['hips'], mid, (200, 200, 205), 12)
    seg(b['shoulder']['l'], b['shoulder']['r'], (200, 200, 205), 6); seg(b['hipJoint']['l'], b['hipJoint']['r'], (200, 200, 205), 6)
    x, y = P(b['head']); d.ellipse([x - 12, y - 13, x + 12, y + 13], fill=(215, 180, 150))
    hr = b['headR']; nose = [b['head'][0] + hr[2] * 0.13, b['head'][1] + hr[5] * 0.13, b['head'][2] + hr[8] * 0.13]
    seg(b['head'], nose, (60, 40, 40), 3)
    limb('l'); arm('l')
for i, f in enumerate(frames):
    cx, cy = (i % cols) * CW, (i // cols) * CH
    d.rectangle([cx, cy, cx + CW - 1, cy + CH - 1], outline=(50, 52, 60))
    d.text((cx + 6, cy + 4), f['name'], fill=(230, 230, 230))
    draw(f['body'], cx + 85, cy + CH - 22, 'side', f.get('pitch', 0), f)
    draw(f['body'], cx + 225, cy + CH - 22, 'front', f.get('pitch', 0), f)
img.save(out)
