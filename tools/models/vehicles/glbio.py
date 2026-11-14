import json, struct, numpy as np
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(path):
    d = open(path,'rb').read()
    l = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20+l])
    off = 20 + l
    bl = struct.unpack('<I', d[off:off+4])[0]
    b = d[off+8:off+8+bl]
    return j, b
def acc(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]; dt = CT[a['componentType']]
    o = bv.get('byteOffset',0) + a.get('byteOffset',0)
    stride = bv.get('byteStride')
    isz = np.dtype(dt).itemsize*n
    if stride and stride != isz:
        raw = np.frombuffer(b, np.uint8, count=stride*a['count'], offset=o).reshape(a['count'], stride)[:, :isz]
        return np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n) if n>1 else np.frombuffer(raw.tobytes(), dt)
    arr = np.frombuffer(b, dt, count=a['count']*n, offset=o)
    return arr.reshape(a['count'], n) if n > 1 else arr.copy()

class Writer:
    """Builds a GLB: add accessors, meshes, nodes, materials."""
    def __init__(self):
        self.j = {'asset': {'version': '2.0', 'generator': 'Street Fight UK vehicles tool'}, 'scene': 0, 'scenes': [{'nodes': []}],
                  'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
        self.bin = bytearray()
    def _view(self, data, target):
        while len(self.bin) % 4: self.bin += b'\0'
        o = len(self.bin); self.bin += data
        self.j['bufferViews'].append({'buffer': 0, 'byteOffset': o, 'byteLength': len(data), 'target': target})
        return len(self.j['bufferViews']) - 1
    def accessor(self, arr, index=False):
        arr = np.ascontiguousarray(arr)
        if index:
            arr = arr.astype(np.uint16 if arr.max() < 65535 else np.uint32)
            ct = 5123 if arr.dtype == np.uint16 else 5125
            v = self._view(arr.tobytes(), 34963)
            a = {'bufferView': v, 'componentType': ct, 'count': int(arr.size), 'type': 'SCALAR'}
        else:
            arr = arr.astype(np.float32)
            n = arr.shape[1]
            v = self._view(arr.tobytes(), 34962)
            a = {'bufferView': v, 'componentType': 5126, 'count': int(arr.shape[0]), 'type': {2:'VEC2',3:'VEC3',4:'VEC4'}[n]}
            if n == 3:
                a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1
    def material(self, m):
        self.j['materials'].append(m); return len(self.j['materials']) - 1
    def mesh(self, name, prims):
        """prims: list of (pos, normal, uv|None, index, material, colour|None)"""
        out = []
        for pos, nrm, uv, idx, mat, *rest in prims:
            at = {'POSITION': self.accessor(pos), 'NORMAL': self.accessor(nrm)}
            if uv is not None: at['TEXCOORD_0'] = self.accessor(uv)
            out.append({'attributes': at, 'indices': self.accessor(idx, True), 'material': mat})
        self.j['meshes'].append({'name': name, 'primitives': out}); return len(self.j['meshes']) - 1
    def node(self, n, root=True):
        self.j['nodes'].append(n); i = len(self.j['nodes']) - 1
        if root: self.j['scenes'][0]['nodes'].append(i)
        return i
    def save(self, path):
        for k in ['materials','meshes','accessors','bufferViews','nodes']:
            if not self.j[k]: del self.j[k]
        while len(self.bin) % 4: self.bin += b'\0'
        self.j['buffers'] = [{'byteLength': len(self.bin)}]
        js = json.dumps(self.j, separators=(',',':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)
