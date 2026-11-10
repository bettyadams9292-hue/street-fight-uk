import type { Pose } from './poses';

/**
 * Poses for things people do outside a fight: home gym kit, crew at home,
 * and the household (cooking, eating, washing, sleeping). Kept apart from
 * the renderer so the simulation and tests can use them without Three.js.
 */
type J = [number, number, number];
/** Poses for training on gym kit, and for pedestrians sitting, chatting and window-shopping. */
export function activityPose(act: string, time: number): Pose {
  const t = time;
  const sn = Math.sin;
  const base = (j: Partial<Record<string, J>>, drop = 0.03): Pose => ({
    joints: {
      hips: [0, 0, 0], spine: [0.05, 0, 0], head: [0, 0, 0],
      lShoulder: [-0.05, 0, 0.06], lElbow: [-0.2, 0, 0], rShoulder: [-0.05, 0, -0.06], rElbow: [-0.2, 0, 0],
      lHip: [0, 0, 0.05], lKnee: [0.05, 0, 0], rHip: [0, 0, -0.05], rKnee: [0.05, 0, 0],
      ...j,
    } as Pose['joints'],
    drop,
  });
  switch (act) {
    case 'run': {
      const p = t * 9;
      return base({
        spine: [0.2, 0, 0], lHip: [-0.7 * sn(p), 0, 0.05], rHip: [0.7 * sn(p), 0, -0.05],
        lKnee: [0.4 + 0.8 * Math.max(0, sn(p + 1.2)), 0, 0], rKnee: [0.4 + 0.8 * Math.max(0, -sn(p + 1.2)), 0, 0],
        lShoulder: [0.6 * sn(p), 0, -0.15], rShoulder: [-0.6 * sn(p), 0, 0.15], lElbow: [-1.5, 0, 0], rElbow: [-1.5, 0, 0],
      }, 0.04 + 0.04 * Math.abs(sn(p)));
    }
    case 'cycle': {
      const p = t * 6;
      return base({
        spine: [0.45, 0, 0], head: [-0.3, 0, 0],
        lHip: [-1.25 + 0.4 * sn(p), 0, 0.12], rHip: [-1.25 - 0.4 * sn(p), 0, -0.12],
        lKnee: [1.5 - 0.45 * sn(p), 0, 0], rKnee: [1.5 + 0.45 * sn(p), 0, 0],
        lShoulder: [-1.1, 0, -0.2], rShoulder: [-1.1, 0, 0.2], lElbow: [-0.4, 0, 0], rElbow: [-0.4, 0, 0],
      }, 0.32);
    }
    case 'curl': {
      const a = Math.abs(sn(t * 2.6));
      const b = Math.abs(sn(t * 2.6 + Math.PI / 2));
      return base({ lShoulder: [-0.15, 0, -0.12], rShoulder: [-0.15, 0, 0.12], lElbow: [-(0.2 + 1.9 * a), 0, 0], rElbow: [-(0.2 + 1.9 * b), 0, 0], lHip: [0, 0, 0.12], rHip: [0, 0, -0.12] }, 0.05);
    }
    case 'press': {
      // Squat and press: dip, then drive the bar overhead.
      const k = (sn(t * 2.2) + 1) / 2;
      return base({
        lShoulder: [-1.6 - 1.4 * k, 0, -0.35], rShoulder: [-1.6 - 1.4 * k, 0, 0.35], lElbow: [-(1.9 - 1.8 * k), 0, 0], rElbow: [-(1.9 - 1.8 * k), 0, 0],
        lHip: [-0.9 * (1 - k), 0, 0.2], rHip: [-0.9 * (1 - k), 0, -0.2], lKnee: [1.3 * (1 - k), 0, 0], rKnee: [1.3 * (1 - k), 0, 0], spine: [0.15 * (1 - k), 0, 0],
      }, 0.05 + 0.32 * (1 - k));
    }
    case 'bag': {
      // One-two on the bag.
      const p = (t * 3.2) % 2;
      const left = p < 1;
      const ext = Math.sin(Math.PI * (p % 1));
      return base({
        hips: [0, left ? -0.3 : 0.2, 0], spine: [0.15, left ? -0.25 : 0.25, 0],
        lShoulder: [-0.95 - (left ? 0.75 * ext : 0), 0, -0.3], lElbow: [-(1.85 - (left ? 1.75 * ext : 0)), 0, 0],
        rShoulder: [-0.8 - (!left ? 0.85 * ext : 0), 0, 0.4], rElbow: [-(2.1 - (!left ? 2.0 * ext : 0)), 0, 0],
        lHip: [-0.3, 0, 0.06], lKnee: [0.35, 0, 0], rHip: [0.3, 0, -0.06], rKnee: [0.45, 0, 0],
      }, 0.06);
    }
    case 'speedball': {
      const p = t * 12;
      return base({
        spine: [0.05, 0, 0], head: [-0.1, 0, 0],
        lShoulder: [-1.55 + 0.25 * sn(p), 0, -0.35], rShoulder: [-1.55 - 0.25 * sn(p), 0, 0.35],
        lElbow: [-1.5 - 0.3 * sn(p), 0, 0], rElbow: [-1.5 + 0.3 * sn(p), 0, 0],
      }, 0.04);
    }
    case 'skip': {
      const p = t * 8;
      const hop = Math.abs(sn(p));
      return base({
        lShoulder: [-0.3, 0, -0.5], rShoulder: [-0.3, 0, 0.5], lElbow: [-0.6, 0, 0], rElbow: [-0.6, 0, 0],
        lHip: [-0.15 * hop, 0, 0.05], rHip: [-0.15 * hop, 0, -0.05], lKnee: [0.3 * hop, 0, 0], rKnee: [0.3 * hop, 0, 0],
      }, 0.02 - 0.09 * hop);
    }
    case 'sit':
      return base({
        spine: [0.12, 0, 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        lShoulder: [-0.45, 0, -0.1], rShoulder: [-0.45, 0, 0.1], lElbow: [-0.7, 0, 0], rElbow: [-0.7, 0, 0],
      }, 0.47);
    case 'talk': {
      const g = sn(t * 2.1);
      return base({
        head: [0.05 * sn(t * 1.3), 0.15 * sn(t * 0.7), 0],
        rShoulder: [-0.5 - 0.25 * g, 0, 0.35], rElbow: [-1.3 - 0.3 * g, 0, 0], lShoulder: [-0.15, 0, -0.15], lElbow: [-0.4, 0, 0],
      });
    }
    case 'browse':
      return base({ head: [0.25, 0.1 * sn(t * 0.5), 0], lShoulder: [0.15, 0, -0.1], rShoulder: [0.15, 0, 0.1], lElbow: [-0.35, 0, 0], rElbow: [-0.35, 0, 0] });
    // ---- crew at home: sitting variations (hips stay on the seat; only the top half changes) ----
    case 'sit_back': // leaning back, arms along the cushions
      return base({
        spine: [-0.22, 0, 0], head: [0.08 + 0.03 * sn(t * 0.4), 0.12 * sn(t * 0.23), 0], lHip: [-1.4, 0, 0.16], rHip: [-1.4, 0, -0.16], lKnee: [1.35, 0, 0], rKnee: [1.35, 0, 0],
        lShoulder: [0.2, 0, -0.75], rShoulder: [0.2, 0, 0.75], lElbow: [-0.5, 0, 0], rElbow: [-0.5, 0, 0],
      }, 0.47);
    case 'sit_phone': // looking down at a phone held in both hands
      return base({
        spine: [0.28, 0, 0], head: [0.5, 0, 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        lShoulder: [-0.75, 0, -0.05], rShoulder: [-0.75, 0, 0.05], lElbow: [-1.55 - 0.05 * sn(t * 3), 0, 0], rElbow: [-1.55, 0, 0],
      }, 0.47);
    case 'sit_talk': // sat, turned a little, one hand going
      return base({
        spine: [0.1, 0.25 * sn(t * 0.5), 0], head: [0.05, 0.35 + 0.1 * sn(t * 1.1), 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        rShoulder: [-0.6 - 0.25 * sn(t * 2.2), 0, 0.3], rElbow: [-1.2 - 0.3 * sn(t * 2.2), 0, 0], lShoulder: [-0.45, 0, -0.1], lElbow: [-0.7, 0, 0],
      }, 0.47);
    case 'sit_arms': // sat with arms folded
      return base({
        spine: [0.05, 0, 0], head: [0, 0.2 * sn(t * 0.3), 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        lShoulder: [-0.55, 0, -0.35], rShoulder: [-0.55, 0, 0.35], lElbow: [-2.1, 0.6, 0], rElbow: [-2.1, -0.6, 0],
      }, 0.47);
    // ---- standing at home ----
    case 'phone':
      return base({ head: [0.55, 0, 0], spine: [0.12, 0, 0], lShoulder: [-0.7, 0, -0.05], rShoulder: [-0.7, 0, 0.05], lElbow: [-1.6, 0, 0], rElbow: [-1.6 - 0.05 * sn(t * 3), 0, 0] });
    case 'arms':
      return base({ head: [0, 0.25 * sn(t * 0.35), 0], lShoulder: [-0.55, 0, -0.35], rShoulder: [-0.55, 0, 0.35], lElbow: [-2.1, 0.6, 0], rElbow: [-2.1, -0.6, 0] });
    case 'look':
      return base({ head: [0.05, 0.6 * sn(t * 0.45), 0], spine: [0.03, 0.15 * sn(t * 0.45), 0], lShoulder: [-0.05, 0, -0.12], rShoulder: [-0.05, 0, 0.12] });
    case 'stretch': {
      const k = (sn(t * 0.9) + 1) / 2;
      return base({ spine: [-0.1 * k, 0.4 * sn(t * 0.45), 0.25 * sn(t * 0.45)], lShoulder: [-2.6 * k - 0.2, 0, -0.25], rShoulder: [-2.6 * k - 0.2, 0, 0.25], lElbow: [-0.3, 0, 0], rElbow: [-0.3, 0, 0], head: [-0.2 * k, 0, 0] });
    }
    case 'laugh': {
      const b = Math.abs(sn(t * 9));
      return base({ spine: [0.15 + 0.12 * b, 0, 0], head: [-0.25 + 0.1 * b, 0, 0], lShoulder: [-0.4, 0, -0.25], rShoulder: [-0.4, 0, 0.25], lElbow: [-1.2, 0, 0], rElbow: [-1.2, 0, 0] });
    }
    case 'drink': {
      const k = Math.max(0, sn(t * 0.8));
      return base({ head: [-0.35 * k, 0, 0], rShoulder: [-1.2 - 0.6 * k, 0, 0.2], rElbow: [-1.9 + 0.2 * k, 0, 0], lShoulder: [-0.1, 0, -0.15] });
    }
    // ---- household (Stage 12) ----
    case 'reach': { // into the fridge or a wall cupboard: one arm in, the other on the door
      const k = (sn(t * 2.4) + 1) / 2;
      return base({
        spine: [0.18, 0, 0], head: [0.15, 0.1 * sn(t * 1.3), 0],
        rShoulder: [-1.35 - 0.2 * k, 0, 0.12], rElbow: [-0.35 - 0.3 * k, 0, 0], lShoulder: [-0.9, 0, -0.45], lElbow: [-0.5, 0, 0],
      });
    }
    case 'reach_low': { // crouched at a low cupboard or the oven
      const k = (sn(t * 2.2) + 1) / 2;
      return base({
        spine: [0.4, 0, 0], head: [0.2, 0, 0],
        lHip: [-1.15, 0, 0.2], rHip: [-0.6, 0, -0.15], lKnee: [1.9, 0, 0], rKnee: [1.6, 0, 0],
        rShoulder: [-1.1 - 0.25 * k, 0, 0.15], rElbow: [-0.3 - 0.3 * k, 0, 0], lShoulder: [-0.7, 0, -0.3], lElbow: [-0.6, 0, 0],
      }, 0.36);
    }
    case 'chop': { // knife hand going, the other holding the food
      const c = Math.abs(sn(t * 11));
      return base({
        spine: [0.25, 0, 0], head: [0.45, 0, 0],
        rShoulder: [-0.75 - 0.15 * c, 0, 0.18], rElbow: [-1.05 - 0.45 * c, 0, 0],
        lShoulder: [-0.85, 0, -0.1], lElbow: [-1.2, 0, 0],
      });
    }
    case 'stir': { // stirring a pan: the hand goes round
      const a = t * 4;
      return base({
        spine: [0.2, 0, 0], head: [0.4, 0, 0],
        rShoulder: [-0.95 + 0.14 * sn(a), 0.12 * Math.cos(a), 0.2 + 0.12 * Math.cos(a)], rElbow: [-1.25 + 0.15 * sn(a), 0, 0],
        lShoulder: [-0.65, 0, -0.2], lElbow: [-1.3, 0, 0],
      });
    }
    case 'plate': // both hands out, carrying a plate
      return base({ spine: [0.1, 0, 0], head: [0.3, 0, 0], lShoulder: [-0.95, 0, -0.1], rShoulder: [-0.95, 0, 0.1], lElbow: [-1.15, 0, 0], rElbow: [-1.15, 0, 0] });
    case 'wait': // waiting for the oven: arms folded, glancing at it
      return base({ head: [0.25, 0.3 * sn(t * 0.6), 0], lShoulder: [-0.55, 0, -0.35], rShoulder: [-0.55, 0, 0.35], lElbow: [-2.1, 0.6, 0], rElbow: [-2.1, -0.6, 0] });
    case 'eat': { // sat at the table: fork to mouth, the other hand on the table
      const k = Math.max(0, sn(t * 1.7));
      return base({
        spine: [0.2, 0, 0], head: [0.25 - 0.3 * k, 0, 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        rShoulder: [-0.8 - 0.55 * k, 0, 0.3 - 0.1 * k], rElbow: [-1.1 - 1.0 * k, 0, 0], lShoulder: [-0.75, 0, -0.15], lElbow: [-1.0, 0, 0],
      }, 0.47);
    }
    case 'sit_drink': { // sat with a mug
      const k = Math.max(0, sn(t * 0.9));
      return base({
        spine: [0.12, 0, 0], head: [-0.3 * k, 0, 0], lHip: [-1.5, 0, 0.12], rHip: [-1.5, 0, -0.12], lKnee: [1.5, 0, 0], rKnee: [1.5, 0, 0],
        rShoulder: [-1.1 - 0.55 * k, 0, 0.2], rElbow: [-1.9 + 0.2 * k, 0, 0], lShoulder: [-0.45, 0, -0.1], lElbow: [-0.7, 0, 0],
      }, 0.47);
    }
    case 'shower': { // washing hair, then rinsing off arms and shoulders
      const phase = Math.floor(t / 3.2) % 2;
      const w = sn(t * 7);
      if (phase === 0)
        return base({
          head: [-0.25, 0, 0], spine: [-0.05, 0, 0],
          lShoulder: [-2.5 + 0.15 * w, 0, -0.45], lElbow: [-1.7, 0, 0], rShoulder: [-2.5 - 0.15 * w, 0, 0.45], rElbow: [-1.7, 0, 0],
        });
      return base({
        head: [-0.35, 0.2 * sn(t * 0.8), 0], spine: [0.05, 0.15 * sn(t * 0.8), 0],
        lShoulder: [-1.0, 0, -0.2 + 0.2 * w], lElbow: [-1.6, 0, 0], rShoulder: [-0.6, 0, 0.3], rElbow: [-1.5 - 0.3 * w, 0, 0],
      });
    }
    case 'wash_hands': { // leaning over the sink, rubbing hands under the tap
      const w = sn(t * 10);
      return base({ spine: [0.35, 0, 0], head: [0.35, 0, 0], lShoulder: [-0.75, 0, -0.08 + 0.08 * w], rShoulder: [-0.75, 0, 0.08 + 0.08 * w], lElbow: [-0.9, 0, 0], rElbow: [-0.9, 0, 0] });
    }
    case 'wash_face': { // bent over, splashing water up to the face
      const k = Math.max(0, sn(t * 3));
      return base({ spine: [0.6, 0, 0], head: [0.25, 0, 0], lShoulder: [-0.9 - 0.5 * k, 0, -0.15], rShoulder: [-0.9 - 0.5 * k, 0, 0.15], lElbow: [-1.3 - 0.9 * k, 0, 0], rElbow: [-1.3 - 0.9 * k, 0, 0] });
    }
    case 'brush': { // brushing teeth: the hand at the mouth, scrubbing
      const w = sn(t * 16);
      return base({ spine: [0.15, 0, 0], head: [0.1, 0.1 * sn(t * 0.7), 0], rShoulder: [-1.0, 0, 0.35 + 0.05 * w], rElbow: [-2.15 + 0.12 * w, 0, 0], lShoulder: [-0.2, 0, -0.15], lElbow: [-0.6, 0, 0] });
    }
    case 'lie': { // lying on the back in bed: hips turned flat, head to the headboard, breathing
      const b = 0.03 * sn(t * 1.1);
      return base({
        hips: [-Math.PI / 2, 0, 0], spine: [b, 0, 0], head: [-0.15, 0.25, 0],
        lShoulder: [-0.05, 0, -0.12], rShoulder: [-0.6, 0, 0.35], lElbow: [-0.2, 0, 0], rElbow: [-1.6, 0, 0],
        lHip: [0, 0, 0.06], rHip: [0, 0, -0.06], lKnee: [0.08, 0, 0], rKnee: [0.15, 0, 0],
      }, 0.31);
    }
    case 'sit_edge': // sat on the edge of the bed, hands on knees
      return base({ spine: [0.25, 0, 0], head: [0.2, 0, 0], lHip: [-1.4, 0, 0.14], rHip: [-1.4, 0, -0.14], lKnee: [1.6, 0, 0], rKnee: [1.6, 0, 0], lShoulder: [-0.6, 0, -0.1], rShoulder: [-0.6, 0, 0.1], lElbow: [-0.5, 0, 0], rElbow: [-0.5, 0, 0] }, 0.47);
    case 'lean': // leaning on a counter or wall, weight on one leg
      return base({ hips: [0, 0, 0.05], spine: [0.22, 0, 0], lShoulder: [-0.9, 0, -0.2], rShoulder: [-0.9, 0, 0.2], lElbow: [-0.9, 0, 0], rElbow: [-0.9, 0, 0], lHip: [0.1, 0, 0.1], lKnee: [0.25, 0, 0] });
    default:
      return base({});
  }
}

