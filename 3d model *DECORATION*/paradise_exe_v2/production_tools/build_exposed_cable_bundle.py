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

# 1. Main thick black power feeder cable (X = -8 to +8, diameter 1.5)
c('cable_thick', [-8.0, 11.5, 6.25], [8.0, 13.0, 7.75], 'black_rubber', off=[])

# 2. Secondary gray conduit cable (X = -8 to +8, diameter 1.0, sits below thick cable)
c('cable_gray', [-8.0, 10.25, 6.5], [8.0, 11.25, 7.5], 'gray_vinyl', off=['up'])

# 3. Sagging loose cable (slipped from center tie, sags down in catenary loop)
c('sag_left', [-8.0, 11.75, 5.25], [-4.0, 12.5, 6.0], 'red_jacket', off=[])
c('sag_down', [-4.0, 10.5, 5.25], [-1.5, 11.25, 6.0], 'red_jacket', off=[])
c('sag_bottom', [-1.5, 9.25, 5.25], [1.5, 10.0, 6.0], 'red_jacket', off=[])
c('sag_up', [1.5, 10.5, 5.25], [4.0, 11.25, 6.0], 'red_jacket', off=[])
c('sag_right', [4.0, 11.75, 5.25], [8.0, 12.5, 6.0], 'red_jacket', off=[])

# 4. Galvanized wall mounting cleats and cinch straps (at X = -5.5 and X = 5.5)
for side, cx in [('left', -5.5), ('right', 5.5)]:
    # Wall baseplate
    c(f'cleat_base_{side}', [cx - 0.75, 9.5, 7.75], [cx + 0.75, 13.5, 8.0], 'metal', off=['south', 'north'])
    # Top clamping lip
    c(f'cleat_top_{side}', [cx - 0.75, 13.0, 4.75], [cx + 0.75, 13.5, 7.75], 'metal', off=['down', 'south'])
    # Bottom clamping lip
    c(f'cleat_bottom_{side}', [cx - 0.75, 9.75, 4.75], [cx + 0.75, 10.25, 7.75], 'metal', off=['up', 'south'])
    # Front band
    c(f'cleat_front_{side}', [cx - 0.75, 10.25, 4.75], [cx + 0.75, 13.0, 5.25], 'metal', off=['up', 'down', 'south'])
    # Wall bolt
    c(f'cleat_bolt_{side}', [cx - 0.25, 9.0, 7.5], [cx + 0.25, 9.5, 7.75], 'dark_metal', off=['south'])

# 5. Snapped / sheared metal zip-tie hanging loose in center (at X = 0)
c('snapped_tie_upper', [-0.25, 13.0, 5.5], [0.25, 13.5, 7.25], 'metal', off=['down'])
c('snapped_tie_dangle', [-0.25, 8.5, 4.75], [0.25, 11.5, 5.0], 'metal', off=[])

# Geometry audit
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'black_rubber': (0, 0, 'concrete_black.png', 16, 16),
    'gray_vinyl': (16, 0, 'concrete_gray.png', 16, 16),
    'red_jacket': (32, 0, 'concrete_red.png', 16, 16),
    'metal': (0, 16, 'iron_block.png', 16, 16),
    'dark_metal': (16, 16, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.electricaltechnology.org/2019/06/cable-tray-types-installation.html',
    'used': 'commercial stairwell multi-cable harness strapped to wall cleats with loose sagging high-voltage cable loop and broken center tie',
    'limitations': [
        '16-unit modular wall bundle at Z=6.5 with 3-unit sagging catenary cable and wall cleats',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_black, concrete_gray, concrete_red, iron_block, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('exposed_cable_bundle', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 11, 6.5], [20, 18, -12])
views(D, [0, 11, 6.5], {
    'front': [0, 11, -18],
    'three_quarter': [20, 18, -12],
    'back': [-20, 16, 24],
    'gameplay_scale': [32, 24, -28],
    'sag_close': [0, 10, 0]
})
print('Exposed cable bundle build complete.', flush=True)
