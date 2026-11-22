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

# Shared assets: Small wall plate
# Surface-mounted modular electrical wall blanking cover plate with beveled rim, center circular knockout disc, and 4 corner mounting screws; dimension recolors for iron, dark, and copper.

c('wall_flange', [-2.5, 6.0, 7.5], [2.5, 11.0, 8.0], 'metal')
c('face_bevel', [-2.0, 6.5, 7.0], [2.0, 10.5, 7.5], 'metal_dark')
c('center_knockout', [-1.0, 7.5, 6.7], [1.0, 9.5, 7.0], 'metal')
c('screw_tl', [-1.8, 9.8, 6.7], [-1.2, 10.4, 7.0], 'metal_dark')
c('screw_tr', [1.2, 9.8, 6.7], [1.8, 10.4, 7.0], 'metal_dark')
c('screw_bl', [-1.8, 6.6, 6.7], [-1.2, 7.2, 7.0], 'metal_dark')
c('screw_br', [1.2, 6.6, 6.7], [1.8, 7.2, 7.0], 'metal_dark')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'copper': (32, 0, 'exposed_copper.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/metal-blank-wall-plate, https://www.alamy.com/stock-photo/electrical-junction-box-cover.html',
    'used': 'shared assets small wall plate surface-mounted modular electrical wall blanking cover plate with beveled rim, center circular knockout disc, and 4 corner mounting screws; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular small wall plate fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('small_wall_plate', cs, a, regions, plan, area='shared')

checker(D, [0, 8.5, 7.2], [10, 12, 8])
views(D, [0, 8.5, 7.2], {
    'front': [0, 8.5, 18],
    'three_quarter': [12, 10, 14],
    'back': [-12, 10, -4],
    'gameplay_scale': [18, 14, 20],
    'knockout_close': [0, 8.5, 10.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'small_wall_plate.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'small_wall_plate_dark.png')

im_copper = Image.open(D/'small_wall_plate.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'small_wall_plate_copper.png')

(D/'small_wall_plate_iron.png').write_bytes((D/'small_wall_plate.png').read_bytes())

call('create_texture', {'name': 'small_wall_plate_dark', 'data': str(D/'small_wall_plate_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'small_wall_plate_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.5, 7.2], {
        'front_dark': [0, 8.5, 18],
        'three_quarter_dark': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'small_wall_plate_copper', 'data': str(D/'small_wall_plate_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'small_wall_plate_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.5, 7.2], {
        'front_copper': [0, 8.5, 18],
        'three_quarter_copper': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('small_wall_plate', 'Small wall plate', 'Hanging directional sign', 'Freestanding sign post', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'small_wall_plate.bbmodel').write_bytes((D/'shared_small_wall_plate.bbmodel').read_bytes())
(D/'small_wall_plate.geo.json').write_bytes((D/'shared_small_wall_plate.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['small_wall_plate.png', 'small_wall_plate_iron.png', 'small_wall_plate_dark.png', 'small_wall_plate_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'knockout_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Small wall plate complete and verified with 100% full coverage!")
