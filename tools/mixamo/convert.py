#!/usr/bin/env python3
"""
Cuts the owner's Mixamo FBX clips (StreetFightUK-assets/animations) into the game's mocap JSON,
using the Rokoko converter's code (same skeleton names, same format), so araPose.ts plays them.

    python3 -I tools/mixamo/convert.py <animations folder> public/anim/mixamo_mocap.json

Cut times and impact moments ('hit', seconds into the cut) were measured with tools/rokoko's
`analyse` and from each clip's peak reach (hand or foot furthest from the hips).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rokoko'))
import convert as C

C.CLIPS = {
    # Strikes. 'orthodox' mirrors a southpaw take so every fighter leads with the left.
    'mx_jab': ('Punching.fbx', 0.15, 1.00, {'hit': 0.42, 'aim': ['LeftHand', 0.42], 'orthodox': True}),
    'mx_cross': ('Punching (1).fbx', 0.0, 0.87, {'hit': 0.37, 'aim': ['RightHand', 0.37], 'orthodox': True}),
    'mx_cross_b': ('Cross Punch.fbx', 0.65, 1.85, {'hit': 0.48, 'aim': ['RightHand', 0.48], 'orthodox': True}),
    'mx_hook': ('Hook.fbx', 0.70, 1.90, {'hit': 0.47, 'face': 0.0, 'orthodox': True, 'stance_t': 0.0}),
    'mx_elbow': ('Elbow Punching.fbx', 0.0, 1.20, {'hit': 0.43, 'face': 0.0, 'orthodox': True, 'stance_t': 0.0}),
    'mx_knee': ('Illegal Knee.fbx', 0.30, 1.45, {'hit': 0.43, 'face': 0.0, 'orthodox': True, 'stance_t': 0.0}),
    'mx_roundhouse': ('Roundhouse Kick.fbx', 0.45, 2.00, {'hit': 0.62, 'aim': ['RightFoot', 0.62], 'orthodox': True, 'stance_t': 0.0}),
    'mx_roundhouse_b': ('Mma Kick.fbx', 0.30, 1.50, {'hit': 0.53, 'aim': ['RightFoot', 0.53], 'orthodox': True, 'stance_t': 0.0}),
    'mx_headbutt': ('Headbutt.fbx', 0.0, 0.87, {'hit': 0.30, 'face': 0.0}),
    # Being hit.
    'mx_hit_head': ('Head Hit.fbx', 0.0, 1.20, {'face': 0.0}),
    'mx_hit_light': ('Light Hit To Head.fbx', 0.0, 0.83, {'face': 0.0}),
    'mx_hit_uppercut': ('Receive Uppercut To The Face.fbx', 0.0, 1.20, {'face': 0.0}),
    'mx_hit_big': ('Big Hit To Head.fbx', 0.0, 1.60, {'face': 0.0}),
    'mx_stunned': ('Stunned.fbx', 0.0, 2.10, {'face': 0.0}),
}

if __name__ == '__main__':
    C.build(sys.argv[1], sys.argv[2])
