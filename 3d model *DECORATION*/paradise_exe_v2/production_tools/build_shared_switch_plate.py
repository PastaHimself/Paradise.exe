import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions, audit_full_coverage

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Shared assets: Switch plate
# Surface-mounted industrial metal electrical switch plate with stepped face bezel, central toggle lever actuator, slotted mounting screws, and top conduit collar connector; dimension recolors for iron, dark, and copper.

# 1. Base wall plate & stepped face bezel
c('wall_plate', [-3.0, 5.0, 7.2], [3.0, 11.0, 8.0], 'metal')
c('face_bezel', [-2.5, 5.5, 6.6], [2.5, 10.5, 7.2], 'metal_dark')

# 2. Central toggle switch actuator & lever
c('toggle_base', [-1.2, 7.2, 6.1], [1.2, 8.8, 6.6], 'metal')
c('toggle_lever', [-0.5, 8.0, 5.2], [0.5, 9.2, 6.1], 'metal_dark')

# 3. Fastener screws
c('screw_top', [-0.4, 9.8, 6.4], [0.4, 10.2, 6.6], 'metal')
c('screw_bottom', [-0.4, 5.8, 6.4], [0.4, 6.2, 6.6], 'metal')

# 4. Top conduit entry collar
c('conduit_collar_top', [-1.0, 11.0, 6.8], [1.0, 12.5, 8.0], 'metal_dark')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'copper': (32, 0, 'exposed_copper.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/industrial-toggle-switch-plate, https://www.alamy.com/stock-photo/metal-light-switch-plate.html',
    'used': 'shared assets switch plate surface-mounted industrial metal electrical switch plate with stepped face bezel, central toggle lever actuator, slotted mounting screws, and top conduit collar connector; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular switch plate fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('switch_plate', cs, a, regions, plan, area='shared')

checker(D, [0, 8.5, 6.8], [12, 14, 10])
views(D, [0, 8.5, 6.8], {
    'front': [0, 8.5, 18],
    'three_quarter': [12, 10, 14],
    'back': [-12, 10, -4],
    'gameplay_scale': [18, 14, 20],
    'toggle_close': [0, 8.5, 10.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'switch_plate.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'switch_plate_dark.png')

im_copper = Image.open(D/'switch_plate.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'switch_plate_copper.png')

(D/'switch_plate_iron.png').write_bytes((D/'switch_plate.png').read_bytes())

call('create_texture', {'name': 'switch_plate_dark', 'data': str(D/'switch_plate_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'switch_plate_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.5, 6.8], {
        'front_dark': [0, 8.5, 18],
        'three_quarter_dark': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'switch_plate_copper', 'data': str(D/'switch_plate_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'switch_plate_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.5, 6.8], {
        'front_copper': [0, 8.5, 18],
        'three_quarter_copper': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('switch_plate', 'Switch plate', 'Reusable fixture texture states', 'Small wall plate', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'switch_plate.bbmodel').write_bytes((D/'shared_switch_plate.bbmodel').read_bytes())
(D/'switch_plate.geo.json').write_bytes((D/'shared_switch_plate.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['switch_plate.png', 'switch_plate_iron.png', 'switch_plate_dark.png', 'switch_plate_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'toggle_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Switch plate complete and verified with 100% full coverage!")
