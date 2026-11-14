import json, subprocess, re, os, sys
sys.path.insert(0,'/tmp/property')
src = open('/home/claude/wt-property/src/realty/catalogue.ts').read()
props = []
for m in re.finditer(r"P\(\{ id: '([^']+)', name: '[^']*', cat: '(\w+)', type: '[^']*', area: '(\w+)', x: ([\d.]+)", src):
    pid, cat, area, x = m.group(1), m.group(2), m.group(3), float(m.group(4))
    # camera: back off and look up at the front; tall buildings get a higher aim
    if cat == 'mansion':
        d = dict(cx=x + 2.5, cy=2.0, cz=13.0, tx=x, ty=4.8, tz=-4, fov=44)
    elif cat == 'apartment' or cat == 'flat':
        d = dict(cx=x + 3.5, cy=2.4, cz=11.0, tx=x, ty=5.5, tz=-3, fov=50)
    else:
        d = dict(cx=x + 3.5, cy=2.4, cz=10.5, tx=x, ty=3.6, tz=-3, fov=44)
    props.append(dict(id=pid, cat=cat, area=area, x=x, **d))
print(len(props))
json.dump(props, open('/tmp/property/props.json','w'))
