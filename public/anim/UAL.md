# Universal Animation Library (Quaternius)

`ual_mocap.json` is cut from Quaternius' **Universal Animation Library** and **Universal Animation Library 2**
("Standard" editions, `Unreal-Godot/UAL1_Standard.glb` and `UAL2_Standard.glb`), https://quaternius.com.
Licence: **CC0 1.0** (public domain; the packs' License.txt). Credit is not required but is given here.

The source files are not in this repository. To rebuild the JSON, unzip both packs into one folder and run:

    python3 -I tools/ual/convert.py build <folder> public/anim/ual_mocap.json

`src/render/anim/ual.ts` says which clip plays where; the keyed poses stay as the fallback.

| id | source clip | used for |
| --- | --- | --- |
| ual_idle | UAL1 Idle_Loop | RELAXED; look, browse, plate (legs) |
| ual_fold_arms | UAL2 Idle_FoldArms_Loop | arms, wait, sit_arms (top half) |
| ual_talk | UAL1 Idle_Talking_Loop | talk |
| ual_phone | UAL2 Idle_TalkingPhone_Loop | phone, sit_phone (top half) |
| ual_lean | UAL2 Idle_Rail_Loop | lean |
| ual_drink | UAL2 Consume (mirrored) | drink, sit_drink, eat (top half) |
| ual_reach | UAL1 Interact 0.1–1.6 s (mirrored) | reach |
| ual_reach_low | UAL2 Chest_Open 0.3–0.95 s (mirrored) | reach_low |
| ual_carry | UAL2 Walk_Carry_Loop | plate (top half) |
| ual_sit | UAL1 Sitting_Idle_Loop | sit_edge, sit_arms, sit_phone, sit_drink, eat |
| ual_sit_talk | UAL1 Sitting_Talking_Loop | sit_talk |
| ual_drive | UAL1 Driving_Loop | cycle (top half) |
| ual_bag | UAL1 Punch_Jab + Punch_Cross | bag |
| ual_cross | UAL1 Punch_Cross | finisher |
| ual_guard_break | UAL2 Idle_Shield_Break | GUARD_BREAK |
| ual_parried | UAL2 Idle_Shield_Break (mirrored) | PARRIED |
| ual_jump_fall | UAL1 Jump_Loop | JUMP_FALL |
| ual_fall_back | UAL2 Hit_Knockback from 0.05 s | FALL_BACK, LAND_BACK, LYING; lie |
| ual_lay_to_idle | UAL2 LayToIdle | SIT_UP, CROUCH_UP (getting up off the back) |
