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

# Shared assets: Hanging directional sign
# Ceiling-suspended overhead directional corridor sign with dual mounting flanges, steel suspension drop rods, tubular crossbar hanger, extruded perimeter sign frame, double-sided sign panel, and raised directional indicator badges; clean and weathered variants.

# 1. Ceiling anchor flanges & drop rods (Y: 17.5 to 25.5)
c('flange_l', [-6.0, 24.5, -0.8], [-4.0, 25.5, 0.8], 'metal_dark')
c('flange_r', [4.0, 24.5, -0.8], [6.0, 25.5, 0.8], 'metal_dark')
c('rod_l', [-5.25, 17.5, -0.25], [-4.75, 24.5, 0.25], 'metal_dark')
c('rod_r', [4.75, 17.5, -0.25], [5.25, 24.5, 0.25], 'metal_dark')
c('crossbar', [-7.0, 16.5, -0.5], [7.0, 17.5, 0.5], 'metal_dark')

# 2. Extruded perimeter sign frame (Y: 7.5 to 16.5)
c('frame_top', [-8.0, 15.5, -0.6], [8.0, 16.5, 0.6], 'metal_dark')
c('frame_bottom', [-8.0, 7.5, -0.6], [8.0, 8.5, 0.6], 'metal_dark')
c('frame_l', [-8.0, 8.5, -0.6], [-7.0, 15.5, 0.6], 'metal_dark')
c('frame_r', [7.0, 8.5, -0.6], [8.0, 15.5, 0.6], 'metal_dark')

# 3. Double-sided sign face core & raised badges
c('sign_face', [-7.0, 8.5, -0.4], [7.0, 15.5, 0.4], 'sign_white')
c('badge_front', [-4.0, 10.5, 0.4], [4.0, 13.5, 0.6], 'sign_accent')
c('badge_back', [-4.0, 10.5, -0.6], [4.0, 13.5, -0.4], 'sign_accent')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal_dark': (0, 0, 'netherite_block.png', 16, 16),
    'sign_white': (16, 0, 'quartz_block_bottom.png', 16, 16),
    'sign_accent': (32, 0, 'emerald_block.png', 16, 16),
    'sign_weathered': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/overhead-hanging-wayfinding-sign, https://www.alamy.com/stock-photo/suspended-directional-corridor-sign.html',
    'used': 'shared assets hanging directional sign ceiling-suspended overhead directional corridor sign with dual mounting flanges, steel suspension drop rods, tubular crossbar hanger, extruded perimeter sign frame, double-sided sign panel, and raised directional indicator badges; clean and weathered variants',
    'limitations': [
        'modular hanging directional sign fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original netherite_block, quartz_block_bottom, emerald_block, calcite pixels unchanged; clean and weathered variants'
    ]
}

D = build('hanging_directional_sign', cs, a, regions, plan, area='shared')

checker(D, [0, 16.5, 0], [20, 22, 12])
views(D, [0, 16.5, 0], {
    'front': [0, 16.5, 20],
    'three_quarter': [16, 15, 16],
    'back': [-16, 15, -16],
    'gameplay_scale': [24, 18, 24],
    'panel_close': [0, 12.0, 8.0]
})

# Create weathered texture variant
im_weathered = Image.open(D/'hanging_directional_sign.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0)) # faded/weathered sign face
im_weathered.paste(Image.open(S/'copper_block.png').convert('RGBA'), (32, 0)) # tarnished badge
im_weathered.save(D/'hanging_directional_sign_weathered.png')
(D/'hanging_directional_sign_clean.png').write_bytes((D/'hanging_directional_sign.png').read_bytes())

call('create_texture', {'name': 'hanging_directional_sign_weathered', 'data': str(D/'hanging_directional_sign_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'hanging_directional_sign_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 16.5, 0], {
        'front_weathered': [0, 16.5, 20],
        'three_quarter_weathered': [16, 15, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('hanging_directional_sign', 'Hanging directional sign', 'Freestanding sign post', 'Blank sign backing', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'hanging_directional_sign.bbmodel').write_bytes((D/'shared_hanging_directional_sign.bbmodel').read_bytes())
(D/'hanging_directional_sign.geo.json').write_bytes((D/'shared_hanging_directional_sign.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'weathered'],
    'textures': ['hanging_directional_sign.png', 'hanging_directional_sign_clean.png', 'hanging_directional_sign_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'panel_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Shared Hanging directional sign complete and verified with 100% full coverage!")
