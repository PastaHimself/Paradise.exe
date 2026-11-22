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

# 1. Base Footing with Scupper Drainage Opening (Y in [0, 3.0])
c('base_left', [-8.0, 0.0, -4.0], [-3.0, 3.0, 4.0], 'concrete', off=['down', 'east'])
c('base_right', [3.0, 0.0, -4.0], [8.0, 3.0, 4.0], 'concrete', off=['down', 'west'])
c('scupper_bridge', [-3.0, 1.5, -4.0], [3.0, 3.0, 4.0], 'concrete', off=['down', 'east', 'west'])

# 2. Lower Sloped Batter (Y in [3.0, 6.0], Z in [-3.0, 3.0])
c('mid_batter', [-8.0, 3.0, -3.0], [8.0, 6.0, 3.0], 'concrete', off=['down'])

# 3. Upper Stem (Y in [6.0, 13.0], Z in [-1.75, 1.75])
c('upper_stem', [-8.0, 6.0, -1.75], [8.0, 13.0, 1.75], 'concrete', off=['down'])

# 4. Top Chamfer Cap (Y in [13.0, 14.0], Z in [-1.25, 1.25])
c('top_cap', [-8.0, 13.0, -1.25], [8.0, 14.0, 1.25], 'concrete', off=['down'])

# 5. Modular Pin-and-Loop End Connectors
# West end steel loops (projecting past X=-8)
c('loop_w_lower', [-8.5, 4.0, -0.35], [-8.0, 4.75, 0.35], 'steel', off=['east'])
c('loop_w_upper', [-8.5, 10.0, -0.35], [-8.0, 10.75, 0.35], 'steel', off=['east'])

# East end steel loops (hollow loop around drop pin)
for name, ly in [('lower', 2.5), ('upper', 8.5)]:
    c(f'loop_e_n_{name}', [8.0, ly, -0.4], [8.4, ly + 0.75, -0.15], 'steel', off=['west'])
    c(f'loop_e_s_{name}', [8.0, ly, 0.15], [8.4, ly + 0.75, 0.4], 'steel', off=['west'])
    c(f'loop_e_tip_{name}', [8.4, ly, -0.4], [8.65, ly + 0.75, 0.4], 'steel', off=['west'])

# Galvanized connection drop pin at East end (running vertically through loops with 0.05 air gap)
c('drop_pin', [8.15, 1.5, -0.1], [8.35, 11.5, 0.1], 'steel', off=[])

# 6. Precast Threaded Lifting Anchor Loop (on top of cap at Y=14.0)
c('lift_loop', [-0.75, 14.0, -0.25], [0.75, 14.85, 0.25], 'dark_metal', off=['down'])

# 7. Retroreflective Safety Delineator Bracket (front face of upper stem)
c('reflector_mount', [-0.6, 11.5, 1.75], [0.6, 12.75, 1.95], 'reflector_yellow', off=['north'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'concrete': (0, 0, 'concrete_gray.png', 32, 32),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
    'reflector_yellow': (32, 16, 'concrete_yellow.png', 16, 16)
}

plan = {
    'reference': 'https://wa.gov/design/standards/precast-concrete-barrier-type-f',
    'used': 'highway precast concrete median barrier (Jersey / F-shape profile) with scupper stormwater drainage slot, upper sloped batter, top chamfer cap, pin-and-loop modular connection hardware, and safety reflector delineator',
    'limitations': [
        'modular 16-unit length median divider segment with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_gray, iron_block, netherite_block, and concrete_yellow pixels unchanged; static roadway divider; no vehicle impact physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('concrete_divider', cs, a, regions, plan, area='burning_highway')
checker(D, [0, 7, 0], [22, 18, -18])
views(D, [0, 7, 0], {
    'front': [0, 10, -24],
    'three_quarter': [22, 18, -18],
    'back': [-22, 18, 22],
    'gameplay_scale': [34, 26, -28],
    'pin_close': [8, 6, 0]
})

finish('concrete_divider', 'Concrete divider', 'Damaged divider', 'Bent guardrail', area='burning_highway')
print('Concrete divider build and verification complete.', flush=True)
