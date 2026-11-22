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

# 1. Base flanges and posts
c('flange_left', [-7.5, 0.0, -1.5], [-4.5, 0.5, 1.5], 'steel', off=['down'])
c('flange_right', [4.5, 0.0, -1.5], [7.5, 0.5, 1.5], 'steel', off=['down'])
c('post_left', [-6.75, 0.5, -0.75], [-5.25, 16.5, 0.75], 'steel', off=['down', 'up'])
c('post_right', [5.25, 0.5, -0.75], [6.75, 16.5, 0.75], 'steel', off=['down', 'up'])

# 2. Severed top handrail left section with jagged fracture tip
c('top_rail_left', [-8.0, 16.5, -0.75], [-2.5, 18.0, 0.75], 'yellow', off=[])
c('top_break_lip', [-2.5, 16.5, -0.75], [-2.0, 17.25, 0.25], 'yellow', off=['west'])

# 3. Severed top handrail right section with jagged fracture tip
c('top_rail_right', [4.0, 16.5, -0.75], [8.0, 18.0, 0.75], 'yellow', off=[])
c('top_break_lip_r', [3.5, 17.25, -0.25], [4.0, 18.0, 0.75], 'yellow', off=['east'])

# 4. Mid safety rail severed stubs
c('mid_rail_l1', [-8.0, 8.5, -0.5], [-6.75, 9.5, 0.5], 'steel', off=['east'])
c('mid_rail_l2', [-5.25, 8.5, -0.5], [-3.25, 9.5, 0.5], 'steel', off=['west'])
c('mid_rail_r1', [4.5, 8.5, -0.5], [5.25, 9.5, 0.5], 'steel', off=['east'])
c('mid_rail_r2', [6.75, 8.5, -0.5], [8.0, 9.5, 0.5], 'steel', off=['west'])

# 5. Fallen twisted pipe debris in the gap
c('fallen_pipe_1', [-1.0, 0.0, -0.75], [1.75, 1.25, 0.5], 'yellow', off=['down'])
c('fallen_pipe_2', [0.5, 0.0, 0.75], [2.5, 1.0, 1.75], 'steel', off=['down'])

# 6. Mounting bolts (4 left, 4 right)
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
    'reference': 'https://www.simplifiedbuilding.co.uk/blog/bent-handrail-repair/',
    'used': 'breached industrial stairwell safety guardrail with 6-unit open hazardous gap, jagged severed pipe stubs, and fallen pipe debris',
    'limitations': [
        '16-unit modular guardrail with open 6-unit breach and fallen pipe section',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('broken_railing_gap', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 9, 0], [24, 20, -26])
views(D, [0, 9, 0], {
    'front': [0, 10, -32],
    'three_quarter': [24, 20, -26],
    'back': [-24, 18, 26],
    'gameplay_scale': [36, 28, -42],
    'gap_close': [0, 9, -12]
})
print('Broken railing gap build complete.', flush=True)
