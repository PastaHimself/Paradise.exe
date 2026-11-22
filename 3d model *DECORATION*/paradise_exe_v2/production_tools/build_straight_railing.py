import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}

def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base mounting flanges (3x3 footprint, 0.5 height)
c('flange_left', [-7.5, 0.0, -1.5], [-4.5, 0.5, 1.5], 'steel', off=['down'])
c('flange_right', [4.5, 0.0, -1.5], [7.5, 0.5, 1.5], 'steel', off=['down'])

# 2. Upright vertical stanchions (1.5 x 1.5, height 0.5 to 16.5)
# Culled on down (touches flange) and up (touches top handrail)
c('post_left', [-6.75, 0.5, -0.75], [-5.25, 16.5, 0.75], 'steel', off=['down', 'up'])
c('post_right', [5.25, 0.5, -0.75], [6.75, 16.5, 0.75], 'steel', off=['down', 'up'])

# 3. Top safety handrail (continuous X = -8 to +8, height 16.5 to 18.0)
c('top_rail', [-8.0, 16.5, -0.75], [8.0, 18.0, 0.75], 'yellow', off=[])

# 4. Mid safety rail (divided into 3 non-overlapping sections to prevent volume overlap with posts)
c('mid_rail_left', [-8.0, 8.5, -0.5], [-6.75, 9.5, 0.5], 'steel', off=['east'])
c('mid_rail_center', [-5.25, 8.5, -0.5], [5.25, 9.5, 0.5], 'steel', off=['west', 'east'])
c('mid_rail_right', [6.75, 8.5, -0.5], [8.0, 9.5, 0.5], 'steel', off=['west'])

# 5. Mounting anchor bolts on flanges (4 per flange, 0.5x0.5, height 0.25)
for side, cx in [('left', -6.0), ('right', 6.0)]:
    for i, (bx, bz) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
        c(f'bolt_{side}_{i}', [cx + bx - 0.25, 0.5, bz - 0.25], [cx + bx + 0.25, 0.75, bz + 0.25], 'dark_metal', off=['down'])

# Audit geometry
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'steel': (0, 0, 'iron_block.png', 16, 16),
    'yellow': (16, 0, 'concrete_yellow.png', 16, 16),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.safesitefacilities.co.uk/knowledge-base/guidelines-for-staircase-handrails',
    'used': 'commercial stairwell 1100mm industrial tubular steel guardrail with safety yellow handrail, mid safety rail, and bolted base flanges',
    'limitations': [
        '16-unit width, 18-unit height modular straight guardrail segment with flush modular ends',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('straight_railing', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 9, 0], [24, 20, -26])
views(D, [0, 9, 0], {
    'front': [0, 10, -32],
    'three_quarter': [24, 20, -26],
    'back': [-24, 18, 26],
    'gameplay_scale': [36, 28, -42],
    'flange_close': [-6, 4, -10]
})
print('Straight railing build complete.', flush=True)
