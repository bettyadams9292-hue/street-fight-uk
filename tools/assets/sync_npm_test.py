"""Add any tests/*.test.ts missing from package.json's "test" script (run from the repo root)."""
import json, glob, re
p = 'package.json'; s = open(p).read()
cmd = json.loads(s)['scripts']['test']
have = set(re.findall(r'tests/[\w.-]+\.test\.ts', cmd))
missing = [t for t in sorted(glob.glob('tests/*.test.ts')) if t not in have]
if missing:
    new = cmd + ''.join(f' && tsx {t}' for t in missing)
    s = s.replace(json.dumps(cmd)[1:-1], json.dumps(new)[1:-1], 1)
    open(p, 'w').write(s)
    assert json.loads(open(p).read())['scripts']['test'] == new
print('added:', missing)
