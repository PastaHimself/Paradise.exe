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

# Shared assets: Floor border trim
# Modular 16-unit architectural floor transition border trim threshold strip with central raised runner bar, dual flanking beveled transition ramps, and countersunk fastener screw studs; dimension recolors for iron, dark, and copper.

c('center_runner', [-8.0, 0.0, -1.0], [8.0, 0.6, 1.0], 'metal')
c('ramp_front', [-8.0, 0.0, 1.0], [8.0, 0.3, 2.0], 'metal_dark')
c('ramp_back', [-8.0, 0.0, -2.0], [8.0, 0.3, -1.0], 'metal_dark')

c('stud_1', [-6.0, 0.6, -0.2], [-5.2, 0.75, 0.2], 'metal_dark')
c('stud_2', [-2.0, 0.6, -0.2], [-1.2, 0.75, 0.2], 'metal_dark')
c('stud_3', [1.2, 0.6, -0.2], [2.0, 0.75, 0.2], 'metal_dark')
c('stud_4', [5.2, 0.6, -0.2], [6.0, 0.75, 0.2], 'metal_dark')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'copper': (32, 0, 'exposed_copper.png', 16, 16),
    'calcite': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/commercial-floor-transition-strip, https://www.alamy.com/stock-photo/metal-carpet-threshold-bar.html',
    'used': 'shared assets floor border trim modular 16-unit architectural floor transition border trim threshold strip with central raised runner bar, dual flanking beveled transition ramps, and countersunk fastener screw studs; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular floor border trim fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper, calcite pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('floor_border_trim', cs, a, regions, plan, area='shared')

checker(D, [0, 0.4, 0], [18, 6, 10])
views(D, [0, 0.4, 0], {
    'front': [0, 6.0, 16],
    'three_quarter': [14, 10, 14],
    'back': [-14, 10, -14],
    'gameplay_scale': [20, 12, 20],
    'top': [0, 16, 0],
    'stud_close': [0, 1.0, 6.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'floor_border_trim.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'floor_border_trim_dark.png')

im_copper = Image.open(D/'floor_border_trim.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'floor_border_trim_copper.png')

(D/'floor_border_trim_iron.png').write_bytes((D/'floor_border_trim.png').read_bytes())

call('create_texture', {'name': 'floor_border_trim_dark', 'data': str(D/'floor_border_trim_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'floor_border_trim_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0.4, 0], {
        'front_dark': [0, 6.0, 16],
        'three_quarter_dark': [14, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'floor_border_trim_copper', 'data': str(D/'floor_border_trim_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'floor_border_trim_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0.4, 0], {
        'front_copper': [0, 6.0, 16],
        'three_quarter_copper': [14, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('floor_border_trim', 'Floor border trim', 'Corner trim', 'Door frame trim', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'floor_border_trim.bbmodel').write_bytes((D/'shared_floor_border_trim.bbmodel').read_bytes())
(D/'floor_border_trim.geo.json').write_bytes((D/'shared_floor_border_trim.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['floor_border_trim.png', 'floor_border_trim_iron.png', 'floor_border_trim_dark.png', 'floor_border_trim_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'top.png', 'stud_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Floor border trim complete and verified with 100% full coverage!")
