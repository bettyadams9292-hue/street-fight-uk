import sys, json, numpy as np, math
sys.path.insert(0,'/home/claude/street-fight-uk/tools'); sys.path.insert(0,'/home/claude/street-fight-uk/tools/models')
import glbsheet
from lowpoly import Model, rot_y
js,binc=glbsheet.load_glb('gym.glb')
mats=js['materials']
M=np.eye(4)
for ni in [0,1,2]: M=M@glbsheet.mat4(js['nodes'][ni])
byname={js['nodes'][c]['name']:c for c in js['nodes'][2]['children']}
OBJECTS={
  'dumbbell_rack': ['Cube','Cube.001','Cylinder.025','Cylinder.026','Cylinder.027','Cylinder.028','Cylinder.029'],
  'flat_bench': ['Cube.002','Cube.003'],
  'incline_bench': ['Cube.004','Cube.006','Cube.007'],
  'barbell': ['Cylinder','Cylinder.002','Cylinder.003','Cylinder.004','Cylinder.005','Cylinder.006','Cylinder.007'],
  'plate_stack_b': ['Cylinder.019','Cylinder.020','Cylinder.021'],
  'dumbbell_small': ['Cylinder.008','Cylinder.009','Cylinder.010'],
  'dumbbell_medium': ['Cylinder.011','Cylinder.012','Cylinder.013','Cylinder.014','Cylinder.015'],
  'dumbbell_large': ['Cylinder.016','Cylinder.017','Cylinder.018'],
  'plate_stack': ['Cylinder.022','Cylinder.023','Cylinder.024'],
  'punch_bag': ['Cylinder.030','Plane'],
  'mat': ['Plane.001'],
}
clusters=json.load(open('clusters.json'))
allnames=sum(OBJECTS.values(),[])
for v in clusters.values():
    for n in v: assert n in allnames, n
for name, groups in OBJECTS.items():
    tris=[]
    def walk(ni,MM):
        n=js['nodes'][ni]
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                P=glbsheet.accessor(js,binc,pr['attributes']['POSITION'])
                P=(MM@np.c_[P,np.ones(len(P))].T).T[:,:3]
                idx=glbsheet.accessor(js,binc,pr['indices']).astype(int).reshape(-1,3)
                m=mats[pr['material']]
                col=list(m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[0.5,0.5,0.5,1])[:3])
                metal = m.get('name')=='material'
                if metal: col=[0.75,0.76,0.78]
                for t in idx: tris.append((P[t], col, 'metal' if metal else 'solid'))
        for c in n.get('children',[]): walk(c, MM@glbsheet.mat4(js['nodes'][c]))
    for g in groups: walk(byname[g], M@glbsheet.mat4(js['nodes'][byname[g]]))
    allp=np.concatenate([t[0] for t in tris]); lo,hi=allp.min(0),allp.max(0)
    size=hi-lo
    R=np.eye(3)
    if size[2]>size[0]*1.15: R=rot_y(math.pi/2)  # long side along x
    out=Model()
    for P,col,mat in tris:
        Q=(R@P.T).T
        out.tris[mat].append((Q,col))
    lo2,hi2=out.bounds()
    off=np.array([-(lo2[0]+hi2[0])/2, -lo2[1], -(lo2[2]+hi2[2])/2])
    for mat in out.tris:
        out.tris[mat]=[(P+off,c) for P,c in out.tris[mat]]
    lo3,hi3=out.bounds()
    out.save(f'/home/claude/street-fight-uk/public/models/gym/{name}.glb')
    print(f'{name:16s} {out.triangles():5d} tris  size {np.round(hi3-lo3,2)}')
