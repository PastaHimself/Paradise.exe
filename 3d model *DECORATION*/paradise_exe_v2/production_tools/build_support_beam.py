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

# 1. Main I-Beam Section (Spanning X: -7.25 to 7.25 between wall endplates)
c('flange_top', [-7.25, 15.0, -2.5], [7.25, 16.0, 2.5], 'steel', off=['east', 'west'])
c('flange_bot', [-7.25, 10.0, -2.5], [7.25, 11.0, 2.5], 'steel', off=['east', 'west'])
c('web', [-7.25, 11.0, -0.5], [7.25, 15.0, 0.5], 'steel', off=['up', 'down', 'east', 'west'])

# 2. End Wall Bearing Plates (at X = ±8.0)
c('endplate_l', [-8.0, 9.0, -3.25], [-7.25, 17.0, 3.25], 'steel', off=['west'])
c('endplate_r', [7.25, 9.0, -3.25], [8.0, 17.0, 3.25], 'steel', off=['east'])

# Endplate Structural Bolts (above top flange at Y=16.5, below bottom flange at Y=9.5)
for side, ex0, ex1, b_off in [('l', -7.25, -6.85, 'west'), ('r', 6.85, 7.25, 'east')]:
    for by in [9.5, 16.5]:
        for bz in [-2.25, 2.25]:
            c(f'bolt_{side}_{by}_{bz}', [ex0, by - 0.3, bz - 0.3],
              [ex1, by + 0.3, bz + 0.3], 'dark_metal', off=[b_off])

# 3. Transverse Web Stiffener Plates (at X = -3.5, 0.0, 3.5)
for sx in [-3.5, 0.0, 3.5]:
    c(f'stiffener_f_{sx}', [sx - 0.35, 11.0, 0.5], [sx + 0.35, 15.0, 2.25], 'steel', off=['up', 'down', 'north'])
    c(f'stiffener_b_{sx}', [sx - 0.35, 11.0, -2.25], [sx + 0.35, 15.0, -0.5], 'steel', off=['up', 'down', 'south'])

# 4. Diagonal Brace Connection Gusset Plate (centered under bottom flange at X=0)
c('gusset_plate', [-2.5, 7.0, -0.35], [2.5, 10.0, 0.35], 'steel', off=['up'])
c('gusset_cleat_f', [-2.25, 9.65, 0.35], [2.25, 10.0, 1.25], 'dark_metal', off=['up', 'north'])
c('gusset_cleat_b', [-2.25, 9.65, -1.25], [2.25, 10.0, -0.35], 'dark_metal', off=['up', 'south'])

# Gusset connection bolt heads (front and back)
for bx in [-1.5, 1.5]:
    c(f'gusset_bolt_f_{bx}', [bx - 0.35, 7.75, 0.35], [bx + 0.35, 8.45, 0.65], 'dark_metal', off=['north'])
    c(f'gusset_bolt_b_{bx}', [bx - 0.35, 7.75, -0.65], [bx + 0.35, 8.45, -0.35], 'dark_metal', off=['south'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'steel': (0, 0, 'cauldron_side.png', 32, 32),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://xtdsteel.com/',
    'used': 'heavy industrial wide-flange structural steel I-beam spanning shaft walls with welded transverse web stiffeners, wall bearing endplates with high-strength structural bolts, and lower gusset connection plate',
    'limitations': [
        'modular 16-unit width structural support beam spanning between wall faces with 0 volume overlaps and 0 coplanar z-fighting',
        'original cauldron_side and netherite_block pixels unchanged; static structural element; no dynamic load deflection physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('support_beam', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 12.5, 0], [22, 20, -18])
views(D, [0, 12.5, 0], {
    'front': [0, 12.5, -24],
    'three_quarter': [22, 20, -18],
    'back': [-22, 20, 22],
    'gameplay_scale': [34, 28, -28],
    'gusset_close': [0, 9, 5]
})

finish('support_beam', 'Support beam', 'Hanging shaft cable', 'Road surface', area='endless_staircase')
print('Support beam build and verification complete.', flush=True)
