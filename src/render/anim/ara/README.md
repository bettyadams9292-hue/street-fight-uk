# Ara 3D Gen animation clips

Clip definitions from Ara 3D Gen (MIT licence, copyright Josh Ola and Ara 3D Gen contributors; see LICENSE),
copied unchanged apart from the header line and two type imports in types.ts. They are
evaluated for this game's 13-joint rig by `../araPose.ts`, which is our own code.

Motion capture (`public/anim/ara_mocap.json`, converted by `tools/ara/convert_mocap.py` from
Ara's mocap-data.ts) comes from the CMU Graphics Lab Motion Capture Database:
"The data used in this project was obtained from mocap.cs.cmu.edu. The database was created
with funding from NSF EIA-0196217." Free to use, including commercially; not to be resold as data.

Left out on purpose: every firearm clip (shooter, gunshot), vehicles, swimming and climbing.
