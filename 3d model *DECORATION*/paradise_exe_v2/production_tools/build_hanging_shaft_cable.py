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

# 1. Overhead ceiling bracket (Y: 28 to 30)
c('ceiling_plate', [-3.0, 29.25, -3.0], [3.0, 30.0, 3.0], 'metal', off=['up'])
c('mounting_lugs', [-1.5, 28.0, -1.5], [1.5, 29.25, 1.5], 'dark_metal', off=['up'])

# 2. Kellems Woven Wire Mesh Grip (solid collar Y in [23.5, 28.0])
c('grip_sleeve', [-1.6, 23.5, -1.6], [1.6, 28.0, 1.6], 'metal', off=['up'])

# 3. Main Cable Trunk (Y in [14.0, 23.5])
c('cable_trunk', [-1.25, 14.0, -1.25], [1.25, 23.5, 1.25], 'black_cable', off=['up', 'down'])

# 4. Galvanized cinch band (at Y in [19.0, 19.75]) around trunk (4 perimeter lips)
c('cinch_n', [-1.4, 19.0, -1.4], [1.4, 19.75, -1.25], 'dark_metal', off=['south'])
c('cinch_s', [-1.4, 19.0, 1.25], [1.4, 19.75, 1.4], 'dark_metal', off=['north'])
c('cinch_w', [-1.4, 19.0, -1.25], [-1.25, 19.75, 1.25], 'dark_metal', off=['east'])
c('cinch_e', [1.25, 19.0, -1.25], [1.4, 19.75, 1.25], 'dark_metal', off=['west'])

# 5. Stripped jacket breakout collar at Y in [13.5, 14.0]
c('breakout_n', [-1.4, 13.5, -1.4], [1.4, 14.0, -1.25], 'metal', off=['south', 'up'])
c('breakout_s', [-1.4, 13.5, 1.25], [1.4, 14.0, 1.4], 'metal', off=['north', 'up'])
c('breakout_w', [-1.4, 13.5, -1.25], [-1.25, 14.0, 1.25], 'metal', off=['east', 'up'])
c('breakout_e', [1.25, 13.5, -1.25], [1.4, 14.0, 1.25], 'metal', off=['west', 'up'])

# 6. Center Black Core Conductor (descends straight to Y=1.5)
c('core_black_main', [-0.5, 5.0, -0.5], [0.5, 14.0, 0.5], 'black_cable', off=['up', 'down'])
c('core_black_tip', [-0.4, 1.5, -0.4], [0.4, 5.0, 0.4], 'black_cable', off=['up'])

# 7. Red Conductor (right breakout, stepped curve with exposed copper tip)
c('red_upper', [0.55, 8.5, -0.4], [1.25, 14.0, 0.4], 'red_cable', off=['up', 'down'])
c('red_mid', [0.95, 4.5, -0.1], [1.65, 8.5, 0.7], 'red_cable', off=['up', 'down'])
c('copper_tip', [1.15, 2.5, 0.1], [1.55, 4.5, 0.5], 'copper', off=['up'])

# 8. Yellow Conductor (left breakout, catenary loop)
c('yellow_upper', [-1.25, 7.5, -0.4], [-0.55, 14.0, 0.4], 'yellow_cable', off=['up', 'down'])
c('yellow_mid', [-1.85, 3.0, 0.0], [-1.15, 7.5, 0.8], 'yellow_cable', off=['up', 'down'])
c('yellow_dangle', [-1.6, 0.75, 0.3], [-1.0, 3.0, 0.9], 'yellow_cable', off=['up'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'dark_metal': (16, 0, 'netherite_block.png', 16, 16),
    'black_cable': (32, 0, 'concrete_black.png', 16, 16),
    'red_cable': (48, 0, 'concrete_red.png', 16, 16),
    'yellow_cable': (0, 16, 'concrete_yellow.png', 16, 16),
    'copper': (16, 16, 'copper_block.png', 16, 16)
}

plan = {
    'reference': 'https://hubbell.com/kellems/',
    'used': 'heavy industrial vertical suspended shaft cable bundle with ceiling mounting bracket, Kellems woven wire mesh strain relief support grip, galvanized cinch bands, and severed multi-conductor breakout harness with exposed copper tips',
    'limitations': [
        'modular 30-unit height vertical shaft cable harness suspended from ceiling with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, netherite_block, concrete_black, concrete_red, concrete_yellow, and copper_block pixels unchanged; static hanging prop; no dynamic swing cable physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('hanging_shaft_cable', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 15, 0], [20, 20, -20])
views(D, [0, 15, 0], {
    'front': [0, 15, -28],
    'three_quarter': [20, 20, -20],
    'back': [-20, 20, 24],
    'gameplay_scale': [32, 26, -32],
    'breakout_close': [0, 10, 6]
})

finish('hanging_shaft_cable', 'Hanging shaft cable', 'Road surface', 'Concrete divider', area='endless_staircase')

# Adjust TODO.md header to Burning Highway
t = ROOT / 'paradise_exe_v2/TODO.md'
s = t.read_text()
s = s.replace('Current: **Endless Staircase Road Surface — IN PROGRESS**', 'Current: **Burning Highway Road surface — IN PROGRESS**')
s = s.replace('Next: **Endless Staircase Concrete Divider**', 'Next: **Burning Highway Concrete divider**')
t.write_text(s)

print('Hanging shaft cable build and verification complete.', flush=True)
