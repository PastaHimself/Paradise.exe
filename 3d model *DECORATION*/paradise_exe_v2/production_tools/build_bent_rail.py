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

# 1. Intact left flange and post
c('flange_left', [-7.5, 0.0, -1.5], [-4.5, 0.5, 1.5], 'steel', off=['down'])
c('post_left', [-6.75, 0.5, -0.75], [-5.25, 16.5, 0.75], 'steel', off=['down', 'up'])

# 2. Intact left straight handrail
c('top_rail_straight', [-8.0, 16.5, -0.75], [-2.0, 18.0, 0.75], 'yellow', off=['east'])

# 3. Bowed/bent handrail segments (impact pushed towards +Z)
c('bent_rail_1', [-2.0, 16.25, -0.75], [1.0, 17.75, 1.75], 'yellow', off=['west', 'east'])
c('bent_rail_apex', [1.0, 16.0, 0.75], [4.5, 17.5, 3.25], 'yellow', off=['west', 'east'])
c('bent_rail_return', [4.5, 16.25, -0.75], [8.0, 17.75, 1.75], 'yellow', off=['west'])

# 4. Mid safety rail (intact on left, bowed on right)
c('mid_rail_straight', [-8.0, 8.5, -0.5], [-6.75, 9.5, 0.5], 'steel', off=['east'])
c('mid_rail_span1', [-5.25, 8.5, -0.5], [-1.5, 9.5, 0.5], 'steel', off=['west', 'east'])
c('mid_rail_bent1', [-1.5, 8.0, -0.5], [2.5, 9.0, 1.5], 'steel', off=['west', 'east'])
c('mid_rail_bent2', [2.5, 8.0, 0.5], [5.25, 9.0, 2.5], 'steel', off=['west', 'east'])
c('mid_rail_return', [6.75, 8.5, -0.5], [8.0, 9.5, 0.5], 'steel', off=['west'])

# 5. Right shifted flange and displaced post
c('flange_right', [4.5, 0.0, 0.25], [7.5, 0.5, 3.25], 'steel', off=['down'])
c('post_right', [5.25, 0.5, 1.0], [6.75, 16.25, 2.5], 'steel', off=['down', 'up'])

# 6. Floor bolts (4 intact on left, 2 pulled/missing on right)
for i, (bx, bz) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
    c(f'bolt_left_{i}', [-6.0 + bx - 0.25, 0.5, bz - 0.25], [-6.0 + bx + 0.25, 0.75, bz + 0.25], 'dark_metal', off=['down'])

# 2 remaining bolts on shifted right flange (pulled out on rear side)
c('bolt_right_0', [6.0 - 1.0 - 0.25, 0.5, 1.75 - 1.0 - 0.25], [6.0 - 1.0 + 0.25, 0.75, 1.75 - 1.0 + 0.25], 'dark_metal', off=['down'])
c('bolt_right_1', [6.0 + 1.0 - 0.25, 0.5, 1.75 - 1.0 - 0.25], [6.0 + 1.0 + 0.25, 0.75, 1.75 - 1.0 + 0.25], 'dark_metal', off=['down'])

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
    'reference': 'https://www.simplifiedbuilding.co.uk/blog/bent-handrail-repair/',
    'used': 'damaged industrial stairwell guardrail section bowed outward by severe impact with sheared anchor bolts and displaced stanchion',
    'limitations': [
        '16-unit width modular damaged guardrail with 3.25-unit lateral deformation peak',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('bent_rail', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 9, 1], [24, 20, -24])
views(D, [0, 9, 1], {
    'front': [0, 10, -32],
    'three_quarter': [24, 20, -24],
    'back': [-24, 18, 28],
    'gameplay_scale': [36, 28, -40],
    'damage_close': [3, 14, -8]
})
print('Bent rail build complete.', flush=True)
