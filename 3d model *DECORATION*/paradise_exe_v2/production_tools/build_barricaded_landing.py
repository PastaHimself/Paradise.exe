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

# 1. Wall upright cleats (mounted to concrete side walls)
c('cleat_left', [-8.0, 0.0, 6.5], [-6.5, 20.0, 8.0], 'timber_dark', off=['south', 'west'])
c('cleat_right', [6.5, 0.0, 6.5], [8.0, 20.0, 8.0], 'timber_dark', off=['south', 'east'])

# 2. Heavy horizontal timber cross beams
c('beam_bottom', [-8.0, 1.5, 5.5], [8.0, 4.5, 6.5], 'timber', off=['south'])
c('beam_mid', [-8.0, 8.0, 5.5], [8.0, 11.5, 6.5], 'timber', off=['south'])
c('beam_top', [-8.0, 15.0, 5.5], [8.0, 18.5, 6.5], 'timber', off=['south'])

# 3. Vertical spacer boards between beams (recessed against cleats)
c('vertical_slat_l', [-5.5, 4.5, 6.5], [-4.0, 8.0, 7.25], 'timber_dark', off=['south'])
c('vertical_slat_r', [4.0, 11.5, 6.5], [5.5, 15.0, 7.25], 'timber_dark', off=['south'])

# 4. Diagonal reinforcement timber braces
c('brace_lower', [-4.0, 4.5, 4.75], [-1.5, 8.0, 5.5], 'timber', off=['south'])
c('brace_upper', [1.5, 11.5, 4.75], [4.0, 15.0, 5.5], 'timber', off=['south'])

# 5. Scavenged heavy industrial steel scrap plate nailed to center
c('metal_plate', [-2.5, 3.0, 4.25], [2.5, 13.5, 4.75], 'scrap_metal', off=['south'])
# Corner square bolts on plate
c('plate_bolt_tl', [-2.25, 12.5, 4.0], [-1.75, 13.0, 4.25], 'dark_metal', off=['south'])
c('plate_bolt_tr', [1.75, 12.5, 4.0], [2.25, 13.0, 4.25], 'dark_metal', off=['south'])
c('plate_bolt_bl', [-2.25, 3.5, 4.0], [-1.75, 4.0, 4.25], 'dark_metal', off=['south'])
c('plate_bolt_br', [1.75, 3.5, 4.0], [2.25, 4.0, 4.25], 'dark_metal', off=['south'])

# 6. Yellow danger hazard notice tag
c('hazard_tag', [-5.5, 12.0, 5.25], [-2.0, 14.5, 5.5], 'hazard_yellow', off=['south'])

# 7. Concrete rubble chunk wedged at floor
c('rubble_main', [2.5, 0.0, 3.5], [5.5, 1.5, 5.5], 'concrete_debris', off=['down', 'south'])
c('rubble_chip', [4.5, 0.0, 2.5], [6.25, 0.85, 3.5], 'concrete_debris', off=['down', 'south'])

# 8. Cleat wall lag bolts
for cy in [2.5, 9.5, 16.5]:
    c(f'lag_bolt_l_{cy}', [-7.5, cy, 5.25], [-7.0, cy + 0.75, 5.5], 'dark_metal', off=['south'])
    c(f'lag_bolt_r_{cy}', [7.0, cy, 5.25], [7.5, cy + 0.75, 5.5], 'dark_metal', off=['south'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'timber': (0, 0, 'planks_spruce.png', 32, 32),
    'timber_dark': (32, 0, 'planks_big_oak.png', 32, 32),
    'scrap_metal': (0, 32, 'cauldron_side.png', 16, 16),
    'dark_metal': (16, 32, 'netherite_block.png', 16, 16),
    'hazard_yellow': (32, 32, 'concrete_yellow.png', 16, 16),
    'concrete_debris': (48, 32, 'stonebrick_cracked.png', 16, 16)
}

plan = {
    'reference': 'https://alamy.com/stock-photo/boarded-up-door.html',
    'used': 'abandoned stairwell emergency landing doorway heavily fortified and barricaded with heavy cross timbers, diagonal reinforcement struts, bolted scrap steel plate, and floor concrete rubble',
    'limitations': [
        'modular 16-unit width barricade sealing landing doorway corridor with 0 volume overlaps and 0 coplanar z-fighting',
        'original planks_spruce, planks_big_oak, cauldron_side, netherite_block, concrete_yellow, and stonebrick_cracked pixels unchanged; static barricade; no breakable physics or destruction stages'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('barricaded_landing', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 10, 6], [20, 18, -14])
views(D, [0, 10, 6], {
    'front': [0, 10, -20],
    'three_quarter': [20, 18, -14],
    'back': [-20, 18, 26],
    'gameplay_scale': [32, 26, -28],
    'plate_close': [0, 8, 0]
})

finish('barricaded_landing', 'Barricaded landing', 'Staircase hatch', 'Stairwell direction sign', area='endless_staircase')
print('Barricaded landing build and verification complete.', flush=True)
