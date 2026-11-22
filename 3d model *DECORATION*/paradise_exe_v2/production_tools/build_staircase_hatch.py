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

# 1. Curb walls (Outer X: [-6.85, 6.85], Z: [-6.85, 6.85], Inner X: [-5.5, 5.5], Z: [-5.5, 5.5], Y in [0, 2.5])
c('curb_west', [-6.85, 0.0, -6.85], [-5.5, 2.5, 6.85], 'curb', off=['down'])
c('curb_east', [5.5, 0.0, -6.85], [6.85, 2.5, 6.85], 'curb', off=['down'])
c('curb_north', [-5.5, 0.0, -6.85], [5.5, 2.5, -5.5], 'curb', off=['down', 'east', 'west'])
c('curb_south', [-5.5, 0.0, 5.5], [5.5, 2.5, 6.85], 'curb', off=['down', 'east', 'west'])

# 2. Void floor inside curb (staircase shaft dark void)
c('shaft_void', [-5.5, 0.0, -5.5], [5.5, 0.25, 5.5], 'void', off=['down', 'north', 'south', 'east', 'west'])

# 3. Main Hatch Cover / Lid (X and Z in [-7.5, 7.5], Y in [2.5, 3.25])
c('hatch_lid', [-7.5, 2.5, -7.5], [7.5, 3.25, 7.5], 'lid', off=['down'])

# 4. Overhanging drip cap lips (clearance > 6.85)
c('drip_north', [-7.5, 1.75, -7.5], [7.5, 2.5, -7.0], 'lid', off=['up'])
c('drip_south', [-7.5, 1.75, 7.0], [7.5, 2.5, 7.5], 'lid', off=['up'])
c('drip_east', [7.0, 1.75, -7.0], [7.5, 2.5, 7.0], 'lid', off=['up', 'north', 'south'])
c('drip_west', [-7.5, 1.75, -7.0], [-7.0, 2.5, 7.0], 'lid', off=['up', 'north', 'south'])

# 5. Heavy Strap Hinges on West side (mounted on top of lid at Y=3.25)
c('hinge_nw', [-7.6, 3.25, -5.5], [-5.5, 3.75, -3.5], 'dark_metal', off=['down'])
c('hinge_sw', [-7.6, 3.25, 3.5], [-5.5, 3.75, 5.5], 'dark_metal', off=['down'])

# 6. Counterbalance Spring Operator Cylinder (inside shaft under lid)
c('spring_tube', [-4.5, 1.25, -5.35], [-1.5, 2.25, -4.6], 'dark_metal', off=['north'])
c('piston_rod', [-1.5, 1.5, -5.1], [1.25, 2.0, -4.85], 'metal', off=['west'])
c('bracket_mount', [1.5, 1.25, -5.35], [2.5, 2.25, -4.6], 'dark_metal', off=['north'])

# 7. Recessed Lift Handle on top of lid (East side)
c('handle_plate', [4.5, 3.25, -1.5], [6.25, 3.4, 1.5], 'dark_metal', off=['down'])
c('drop_handle', [5.1, 3.4, -1.0], [5.65, 3.75, 1.0], 'metal', off=['down'])

# 8. Slam Latch Padlock Hasp on East rim
c('hasp_flange', [7.5, 1.5, -0.75], [7.85, 2.25, 0.75], 'dark_metal', off=['west'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'curb': (0, 0, 'iron_block.png', 32, 32),
    'lid': (32, 0, 'cauldron_side.png', 32, 32),
    'dark_metal': (0, 32, 'netherite_block.png', 16, 16),
    'metal': (16, 32, 'iron_block.png', 16, 16),
    'void': (32, 32, 'concrete_black.png', 16, 16)
}

plan = {
    'reference': 'https://bilco.com/',
    'used': 'commercial industrial companionway floor and deck access hatch with heavy curb, overhanging lid with drip lip, counterbalance spring operator cylinder, strap hinges, recessed lift handle, and slam latch hasp',
    'limitations': [
        'modular 16x16 floor hatch fitting standard block opening with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, cauldron_side, netherite_block, and concrete_black pixels unchanged; static closed hatch; no dynamic opening physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('staircase_hatch', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 2, 0], [24, 22, -20])
views(D, [0, 2, 0], {
    'front': [0, 16, -26],
    'three_quarter': [24, 22, -20],
    'back': [-24, 22, 24],
    'gameplay_scale': [36, 30, -32],
    'latch_close': [6, 5, 0]
})

finish('staircase_hatch', 'Staircase hatch', 'Stairwell direction sign', 'Metal grating', area='endless_staircase')
print('Staircase hatch build and verification complete.', flush=True)
