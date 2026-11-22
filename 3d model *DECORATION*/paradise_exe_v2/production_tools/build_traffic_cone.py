import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from views import views
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: TRAFFIC CONE
# -------------------------------------------------------------------------

# 1. Base Plate (Heavy black recycled rubber base with beveled corners)
# Center slab
c('base_center', [-3.5, 0.0, -2.75], [3.5, 0.6, 2.75], 'rubber', off=['down', 'north', 'south'])
# North wing
c('base_north',  [-2.75, 0.0, 2.75], [2.75, 0.6, 3.5], 'rubber', off=['down', 'south'])
# South wing
c('base_south',  [-2.75, 0.0, -3.5], [2.75, 0.6, -2.75], 'rubber', off=['down', 'north'])

# Molded stacking collar boss (recessed transition from rubber base to cone)
c('base_boss',   [-2.5, 0.6, -2.5], [2.5, 1.0, 2.5], 'rubber', off=['down'])

# 2. Conical Body Tiers (Orange PVC with retroreflective white collars)
c('cone_tier1',  [-2.2, 1.0, -2.2], [2.2, 2.5, 2.2], 'orange', off=['down'])
c('cone_tier2',  [-1.85, 2.5, -1.85], [1.85, 4.5, 1.85], 'orange', off=['down'])
c('cone_collar_lo', [-1.55, 4.5, -1.55], [1.55, 6.25, 1.55], 'white_collar', off=['down'])
c('cone_mid_spacer', [-1.3, 6.25, -1.3], [1.3, 7.75, 1.3], 'orange', off=['down'])
c('cone_collar_hi', [-1.05, 7.75, -1.05], [1.05, 11.25, 1.05], 'white_collar', off=['down'])
c('cone_stem',   [-0.8, 11.25, -0.8], [0.8, 13.5, 0.8], 'orange', off=['down', 'up'])

# 3. Top Rim with Physical Hollow Hole
c('top_hole_floor', [-0.45, 13.5, -0.45], [0.45, 13.75, 0.45], 'dark_inner', off=['down', 'north', 'south', 'east', 'west'])
c('rim_n', [-0.95, 13.5, 0.45], [0.95, 14.5, 0.95], 'orange', off=['south'])
c('rim_s', [-0.95, 13.5, -0.95], [0.95, 14.5, -0.45], 'orange', off=['north'])
c('rim_w', [-0.95, 13.5, -0.45], [-0.45, 14.5, 0.45], 'orange', off=['east', 'north', 'south'])
c('rim_e', [0.45, 13.5, -0.45], [0.95, 14.5, 0.45], 'orange', off=['west', 'north', 'south'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'orange': (0, 0, 'concrete_orange.png', 16, 16),
    'rubber': (16, 0, 'concrete_black.png', 16, 16),
    'white_collar': (32, 0, 'concrete_white.png', 16, 16),
    'dark_inner': (48, 0, 'concrete_black.png', 16, 16),
}

plan = {
    'id': 'burning_highway_traffic_cone',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'MUTCD 28/36-inch freeway traffic cone with beveled square black rubber base, stepped orange conical body, dual retroreflective white collars (6-inch and 4-inch bands), and hollow recessed top grip',
    'notes': [
        'freeway safety traffic cone with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_orange, concrete_black, and concrete_white pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('traffic_cone', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 7, 0], [16, 14, -16])
views(D, [0, 7, 0], {
    'front': [0, 8, -20],
    'three_quarter': [16, 14, -16],
    'back': [-16, 14, 18],
    'gameplay_scale': [28, 20, -24],
    'top_close': [0, 18, 2]
})

finish('traffic_cone', 'Traffic cone', 'Striped roadwork barricade', 'DETOUR sign', area='burning_highway')
print('Traffic cone build and verification complete.', flush=True)
