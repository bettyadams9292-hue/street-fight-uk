/**
 * Dev tool: dumps joint positions for a list of poses so tools/posesheet.py can
 * draw them (side and front views). Usage: tsx tools/posesheet.ts <set> > /tmp/poses.json
 */
import { CLASSIC_METRICS, MODEL_METRICS, solveBody, type Body } from '../src/render/anim/skeleton';
import type { Pose } from '../src/render/poses';

export interface Frame { name: string; body: Body; pitch: number; footL?: number[]; footR?: number[]; ground?: number }
export function frameOf(name: string, pose: Pose, model = true): Frame {
  return { name, body: solveBody(pose, model ? MODEL_METRICS : CLASSIC_METRICS), pitch: pose.pitch ?? 0 };
}
