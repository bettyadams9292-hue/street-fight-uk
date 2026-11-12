# Rokoko motion capture

`rokoko_mocap.json` is cut from Rokoko's free mocap asset pack (https://www.rokoko.com), recorded with Rokoko Smartsuit Pro. The pack ships no licence file. Its readme only points to https://www.youtube.com/rokokomotion. Rokoko gives the pack away for use in projects. The project owner has accepted its terms.

The source FBX files are not in this repository. To rebuild the JSON, unpack the pack and run:

    python3 tools/rokoko/convert.py build <pack folder> public/anim/rokoko_mocap.json

## Clips

| id | take | seconds |
| --- | --- | --- |
| rk_guard_a | Rokoko Studio (Mocap)/Combat/FightingIdle | 20.0, looped |
| rk_guard_b | Legacy/Movement/Idle_FightStance_HUMANIK_769 | 8.0, looped |
| rk_jab | Combat/ShadowBoxing | 8.13–8.75 |
| rk_jab_b | Combat/ShadowBoxing (southpaw, mirrored) | 6.40–7.10 |
| rk_cross | Combat/Boxing | 9.88–10.90 |
| rk_cross_b | Combat/ShadowBoxing | 8.55–9.45 |
| rk_cross_c | Combat/Boxing | 13.55–14.35 |
| rk_front_kick | Combat/BigFrontKick | 3.40–4.60 |
| rk_hit_head | Legacy/Combat/Taunting_GettingPunched | 1.10–2.40 |
| rk_hit_body | Legacy/Combat/Fight_GettingKickedinBalls | 5.35–6.60 |
| rk_stagger | Combat/KnockOut_Loser | 8.8–10.0 |
| rk_knockdown | Legacy/Combat/Taunting_GettingPunched02 | 6.70–8.20 |
| rk_ko | Legacy/Combat/Boxing_GettingKnockedOut | 5.50–7.60 |
| rk_ko_b | Combat/KnockOut_Loser | 9.6–12.4 |
| rk_getup | IdlesMocapPack_noFACE/Rise_04_Smooth | 6.0–8.3 |
