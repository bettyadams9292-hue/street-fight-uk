"""Turn the owner's ambientCG sets into the game's material library (run with python3 -I).
   colour  -> <Name>_c.webp   (sRGB; alpha when the set has an Opacity map)
   normal  -> <Name>_n.webp   (OpenGL convention, linear)
   packed  -> <Name>_orm.webp (R = ambient occlusion, G = roughness, B = metalness: the layout three.js reads)
"""
import json, os, sys
from PIL import Image
SRC='/tmp/tex/x'; OUT=sys.argv[1]; SIZE=512
os.makedirs(OUT, exist_ok=True)
cat=json.load(open('/tmp/tex/catalogue_raw.json'))
out=[]
for e in cat:
    n=e['name']; m=e['maps']; d=os.path.join(SRC,n)
    w,h=m['Color']['size']; s=SIZE/max(w,h); size=(max(1,round(w*s)),max(1,round(h*s)))
    op=lambda k,mode: Image.open(os.path.join(d,m[k]['file'])).convert(mode).resize(size, Image.LANCZOS)
    col=op('Color','RGB')
    if 'Opacity' in m:
        col.putalpha(op('Opacity','L'))
    col.save(os.path.join(OUT,n+'_c.webp'), quality=80, method=6)
    op('NormalGL','RGB').save(os.path.join(OUT,n+'_n.webp'), quality=84, method=6)
    ao=op('AmbientOcclusion','L') if 'AmbientOcclusion' in m else Image.new('L',size,255)
    metal=op('Metalness','L') if 'Metalness' in m else Image.new('L',size,0)
    Image.merge('RGB',(ao,op('Roughness','L'),metal)).save(os.path.join(OUT,n+'_orm.webp'), quality=78, method=6)
    lin=lambda c:((c/255)/12.92 if c/255<=0.04045 else (((c/255)+0.055)/1.055)**2.4)
    px=list(Image.open(os.path.join(d,m['Color']['file'])).convert('RGB').resize((16,16),Image.BOX).getdata())
    avg=[round(sum(lin(p[k]) for p in px)/len(px),4) for k in range(3)]
    out.append({'name':n,'size':list(size),'src':[w,h],'maps':sorted(k for k in m if k!='Preview'),'avgLinear':avg,'rough':e.get('roughness'),'metal':e.get('metalness',0),'ao':'AmbientOcclusion' in m,'alpha':'Opacity' in m,'emission':'Emission' in m,
                'bytes':sum(os.path.getsize(os.path.join(OUT,n+s)) for s in ('_c.webp','_n.webp','_orm.webp'))})
json.dump(out,open('/tmp/tex/processed.json','w'),indent=1)
print(len(out), round(sum(o['bytes'] for o in out)/1e6,1),'MB')
