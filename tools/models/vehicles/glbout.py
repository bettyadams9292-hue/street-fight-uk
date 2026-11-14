import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import Writer
from geom import flat

def materials(w, extra=()):
    tex = {'index': 0}
    ids = {}
    ids['kit'] = w.material({'name': 'kit', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': tex, 'metallicFactor': 0.0, 'roughnessFactor': 0.8}})
    ids['paint'] = w.material({'name': 'paint', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': tex, 'metallicFactor': 0.25, 'roughnessFactor': 0.4}})
    ids['window'] = w.material({'name': 'window', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [0.06, 0.08, 0.13, 1], 'metallicFactor': 0.1, 'roughnessFactor': 0.45}})
    ids['metal'] = w.material({'name': 'metal', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [0.62, 0.64, 0.68, 1], 'metallicFactor': 0.8, 'roughnessFactor': 0.3}})
    ids['plate'] = w.material({'name': 'plate', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [0.92, 0.91, 0.87, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.6}})
    ids['lamp'] = w.material({'name': 'lamp', 'doubleSided': True, 'emissiveFactor': [1.0, 0.95, 0.8], 'pbrMetallicRoughness': {'baseColorFactor': [1, 0.97, 0.88, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.3}})
    w.j['images'] = [{'uri': 'Textures/colormap.png', 'name': 'colormap'}]
    w.j['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
    w.j['textures'] = [{'sampler': 0, 'source': 0}]
    return ids

def add_mesh(w, mats, name, mesh):
    prims = []
    for m, (pos, uv) in mesh.parts.items():
        P, N, U, I = flat(pos, uv)
        if len(P) == 0: continue
        prims.append((P, N, U if m in ('kit', 'paint') else None, I, mats[m]))
    return w.mesh(name, prims)

def prune(w):
    """Drop unused materials (indices remapped)."""
    used = sorted({p['material'] for m in w.j['meshes'] for p in m['primitives']})
    remap = {o: i for i, o in enumerate(used)}
    w.j['materials'] = [w.j['materials'][o] for o in used]
    for m in w.j['meshes']:
        for p in m['primitives']: p['material'] = remap[p['material']]
    if not any('baseColorTexture' in m['pbrMetallicRoughness'] for m in w.j['materials']):
        for k in ('images', 'samplers', 'textures'): w.j.pop(k, None)
