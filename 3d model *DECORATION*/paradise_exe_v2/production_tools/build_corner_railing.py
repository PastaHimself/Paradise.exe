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
c('flange_corner', [-1.5, 0.0, -1.5], [1.5, 0.5, 1.5], 'steel', off=['down'])
c('flange_west', [-7.5, 0.0, -1.5], [-4.5, 0.5, 1.5], 'steel', off=['down'])
c('flange_south', [-1.5, 0.0, 4.5], [1.5, 0.5, 7.5], 'steel', off=['down'])

# 2. Upright vertical stanchions (1.5 x 1.5, height 0.5 to 16.5)
c('post_corner', [-0.75, 0.5, -0.75], [0.75, 16.5, 0.75], 'steel', off=['down', 'up'])
c('post_west', [-6.75, 0.5, -0.75], [-5.25, 16.5, 0.75], 'steel', off=['down', 'up'])
c('post_south', [-0.75, 0.5, 5.25], [0.75, 16.5, 6.75], 'steel', off=['down', 'up'])

# 3. Top safety handrail
c('top_rail_corner', [-0.75, 16.5, -0.75], [0.75, 18.0, 0.75], 'yellow', off=['west', 'south'])
c('top_rail_west', [-8.0, 16.5, -0.75], [-0.75, 18.0, 0.75], 'yellow', off=['east'])
c('top_rail_south', [-0.75, 16.5, 0.75], [0.75, 18.0, 8.0], 'yellow', off=['north'])

# 4. Mid safety rails
c('mid_rail_w1', [-8.0, 8.5, -0.5], [-6.75, 9.5, 0.5], 'steel', off=['east'])
c('mid_rail_w2', [-5.25, 8.5, -0.5], [-0.75, 9.5, 0.5], 'steel', off=['west', 'east'])
c('mid_rail_s1', [-0.5, 8.5, 0.75], [0.5, 9.5, 5.25], 'steel', off=['north', 'south'])
c('mid_rail_s2', [-0.5, 8.5, 6.75], [0.5, 9.5, 8.0], 'steel', off=['north'])

# 5. Mounting anchor bolts on flanges (4 per flange, 0.5x0.5, height 0.25)
flanges = [('corner', 0.0, 0.0), ('west', -6.0, 0.0), ('south', 0.0, 6.0)]
for name, cx, cz in flanges:
    for i, (bx, bz) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
        c(f'bolt_{name}_{i}', [cx + bx - 0.25, 0.5, cz + bz - 0.25], [cx + bx + 0.25, 0.75, cz + bz + 0.25], 'dark_metal', off=['down'])

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
    'used': 'commercial stairwell 90-degree corner tubular guardrail junction with corner post, safety yellow mitered handrail, and bolted flanges',
    'limitations': [
        '16x16 modular corner guardrail block connecting West (X=-8) and South (Z=8) runs',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('corner_railing', cs, a, regions, plan, area='endless_staircase')
checker(D, [-2, 9, 2], [24, 22, -24])
views(D, [-2, 9, 2], {
    'front': [-2, 12, -30],
    'three_quarter': [24, 22, -24],
    'back': [-26, 20, 28],
    'gameplay_scale': [36, 30, -38],
    'corner_close': [4, 18, -4]
})
print('Corner railing build complete.', flush=True)
