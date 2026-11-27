"""Seam check between the mouths and the shell segments (run with Blender's bundled Python).
Entrance ring (z 3) must meet each segment's start (z 0); each segment's end (z 10) must meet the exit ring (z 0).
For every seam: the 21 shared profile points must exist on both sides within 1 mm, and every segment vertex lying in the
seam plane on the profile polyline must have a mouth vertex within 1 mm (no T-gaps), and vice versa.
usage: python ic_ring_vs_segments.py <icecave_dir>
"""
import json
import sys

import numpy as np

import ic_check_glb as c

INNER_TOL = 0.002  # a vertex counts as "on the seam ring" when within 2 mm of the profile polyline


def plane_ring(path, z):
    js, binc = c.load(path)
    P = []
    for m in js["meshes"]:
        for pr in m["primitives"]:
            P.append(c.acc(js, binc, pr["attributes"]["POSITION"]).astype(np.float64))
    P = np.concatenate(P)
    on = P[np.abs(P[:, 2] - z) < 1e-4][:, :2]
    prof = np.array(c.PROFILE)
    keep = []
    for v in on:
        best = 9.0
        for a, b in zip(prof[:-1], prof[1:]):
            t = np.clip(np.dot(v - a, b - a) / np.dot(b - a, b - a), 0, 1)
            best = min(best, float(np.linalg.norm(v - (a + t * (b - a)))))
        if best < INNER_TOL:
            keep.append(v)
    return np.unique(np.round(np.array(keep), 5), axis=0)


def seam(ra, rb):
    prof = np.array(c.PROFILE)
    d = lambda A, B: np.linalg.norm(A[:, None] - B[None], axis=2).min(1)
    return dict(profile_worst_mm_a=round(float(d(prof, ra).max() * 1000), 4),
                profile_worst_mm_b=round(float(d(prof, rb).max() * 1000), 4),
                a_verts=len(ra), b_verts=len(rb),
                b_unmatched_in_a=int((d(rb, ra) > 1e-3).sum()), a_unmatched_in_b=int((d(ra, rb) > 1e-3).sum()),
                max_gap_b_to_a_mm=round(float(d(rb, ra).max() * 1000), 4))


if __name__ == "__main__":
    D = sys.argv[1]
    ent = plane_ring(f"{D}/SM_IceCave_Entrance.glb", 3.0)
    ext = plane_ring(f"{D}/SM_IceCave_Exit.glb", 0.0)
    out = {}
    import glob, os
    tags = sorted(os.path.basename(f)[len("SM_IceCave_Segment_"):-4] for f in glob.glob(f"{D}/SM_IceCave_Segment_*.glb"))
    for tag in tags:
        p = f"{D}/SM_IceCave_Segment_{tag}.glb"
        out[f"Entrance(z3)->Segment_{tag}(z0)"] = seam(ent, plane_ring(p, 0.0))
        out[f"Segment_{tag}(z10)->Exit(z0)"] = seam(plane_ring(p, 10.0), ext)
    print(json.dumps(out, indent=1))
