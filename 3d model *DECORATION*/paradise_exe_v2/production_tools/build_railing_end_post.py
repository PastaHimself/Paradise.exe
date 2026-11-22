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

# 1. Floor mounting flange (3x3 footprint, centered at X = 2.0, Z = 0)
c('flange_floor', [0.5, 0.0, -1.5], [3.5, 0.5, 1.5], 'steel', off=['down'])

# 2. Main vertical terminal stanchion (1.5 x 1.5, Y = 0.5 to 16.5)
c('post_main', [1.25, 0.5, -0.75], [2.75, 16.5, 0.75], 'steel', off=['down', 'up'])

# 3. Top safety handrail (X = -8.0 to 4.0, height 16.5 to 18.0)
c('top_rail', [-8.0, 16.5, -0.75], [4.0, 18.0, 0.75], 'yellow', off=['east'])

# 4. Terminal safety D-loop drop cap and vertical drop (X = 4.0 to 5.5)
c('end_drop_top', [4.0, 16.5, -0.75], [5.5, 18.0, 0.75], 'yellow', off=['west', 'down'])
c('end_drop_vert', [4.0, 8.5, -0.75], [5.5, 16.5, 0.75], 'yellow', off=['up', 'west'])
c('end_drop_bottom', [2.75, 8.5, -0.75], [4.0, 10.0, 0.75], 'yellow', off=['east', 'west'])

# 5. Mid safety rail (X = -8.0 to 1.25, Y = 8.5 to 9.5)
c('mid_rail', [-8.0, 8.5, -0.5], [1.25, 9.5, 0.5], 'steel', off=['east'])

# 6. Wall anchor strut (projecting along +Z to concrete wall at Z = 4.0)
c('wall_strut', [1.5, 11.5, 0.75], [2.5, 12.5, 4.0], 'steel', off=['north', 'south'])
c('wall_flange', [0.5, 10.5, 4.0], [3.5, 13.5, 4.5], 'steel', off=['north', 'south'])

# 7. Floor bolts (4 on floor flange)
for i, (bx, bz) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
    c(f'bolt_floor_{i}', [2.0 + bx - 0.25, 0.5, bz - 0.25], [2.0 + bx + 0.25, 0.75, bz + 0.25], 'dark_metal', off=['down'])

# 8. Wall bolts (4 on wall flange)
for i, (bx, by) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
    c(f'bolt_wall_{i}', [2.0 + bx - 0.25, 12.0 + by - 0.25, 3.75], [2.0 + bx + 0.25, 12.0 + by + 0.25, 4.0], 'dark_metal', off=['south'])

# Geometry audit
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
    'reference': 'https://keesteel.com/industrial-handrail-systems/',
    'used': 'commercial industrial stairwell terminal guardrail stanchion with closed safety D-loop return and wall mounting flange',
    'limitations': [
        'modular railing termination fitting West input (X=-8) and wall anchor at Z=4.0',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('railing_end_post', cs, a, regions, plan, area='endless_staircase')
checker(D, [-1, 9, 1.5], [20, 20, -22])
views(D, [-1, 9, 1.5], {
    'front': [-1, 10, -28],
    'three_quarter': [20, 20, -22],
    'back': [-22, 18, 26],
    'gameplay_scale': [32, 28, -38],
    'return_close': [4, 13, -2]
})
print('Railing end post build complete.', flush=True)
