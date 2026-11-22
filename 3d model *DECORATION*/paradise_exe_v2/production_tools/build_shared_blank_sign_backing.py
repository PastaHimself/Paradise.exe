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

# Shared assets: Blank sign backing
# Surface-mounted or cleat-hung modular extruded aluminum sign backing frame with perimeter border channels, inner substrate plate, pristine blank sign face field, corner reinforcement caps, and rear z-bracket mounting cleats; clean and weathered variants.

# 1. Rear wall mounting cleats (Z: 7.2 to 8.0)
c('cleat_upper', [-8.0, 15.0, 7.2], [8.0, 16.0, 8.0], 'metal_dark')
c('cleat_lower', [-8.0, 8.0, 7.2], [8.0, 9.0, 8.0], 'metal_dark')

# 2. Inner substrate backing plate (Z: 6.5 to 7.2)
c('substrate_plate', [-9.5, 6.5, 6.5], [9.5, 17.5, 7.2], 'metal')

# 3. Outer perimeter extruded frame (Z: 5.8 to 7.2)
c('frame_top', [-10.5, 17.5, 5.8], [10.5, 18.5, 7.2], 'metal_dark')
c('frame_bottom', [-10.5, 5.5, 5.8], [10.5, 6.5, 7.2], 'metal_dark')
c('frame_l', [-10.5, 6.5, 5.8], [-9.5, 17.5, 7.2], 'metal_dark')
c('frame_r', [9.5, 6.5, 5.8], [10.5, 17.5, 7.2], 'metal_dark')

# 4. Pristine blank sign field (Z: 6.0 to 6.5)
c('sign_field', [-9.5, 6.5, 6.0], [9.5, 17.5, 6.5], 'sign_white')

# 5. Front corner reinforcement caps (Z: 5.4 to 5.8)
c('cap_tl', [-10.5, 17.5, 5.4], [-9.5, 18.5, 5.8], 'metal_dark')
c('cap_tr', [9.5, 17.5, 5.4], [10.5, 18.5, 5.8], 'metal_dark')
c('cap_bl', [-10.5, 5.5, 5.4], [-9.5, 6.5, 5.8], 'metal_dark')
c('cap_br', [9.5, 5.5, 5.4], [10.5, 6.5, 5.8], 'metal_dark')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'sign_white': (32, 0, 'quartz_block_bottom.png', 16, 16),
    'calcite_faded': (48, 0, 'calcite.png', 16, 16),
    'copper': (0, 16, 'exposed_copper.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/blank-metal-sign-board, https://www.alamy.com/stock-photo/aluminum-frame-blank-sign.html',
    'used': 'shared assets blank sign backing surface-mounted modular extruded aluminum sign backing frame with perimeter border channels, inner substrate plate, pristine blank sign face field, corner reinforcement caps, and rear z-bracket mounting cleats; clean and weathered variants',
    'limitations': [
        'modular blank sign backing fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, quartz_block_bottom, calcite, exposed_copper pixels unchanged; clean and weathered variants'
    ]
}

D = build('blank_sign_backing', cs, a, regions, plan, area='shared')

checker(D, [0, 12.0, 6.5], [24, 16, 10])
views(D, [0, 12.0, 6.5], {
    'front': [0, 12.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -4],
    'gameplay_scale': [24, 18, 22],
    'field_close': [0, 12.0, 10.0]
})

# Create weathered texture variant
im_weathered = Image.open(D/'blank_sign_backing.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # faded/weathered face
im_weathered.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (16, 0)) # tarnished dark frame
im_weathered.save(D/'blank_sign_backing_weathered.png')
(D/'blank_sign_backing_clean.png').write_bytes((D/'blank_sign_backing.png').read_bytes())

call('create_texture', {'name': 'blank_sign_backing_weathered', 'data': str(D/'blank_sign_backing_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'blank_sign_backing_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.0, 6.5], {
        'front_weathered': [0, 12.0, 18],
        'three_quarter_weathered': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('blank_sign_backing', 'Blank sign backing', 'Arrow sheet', 'Legible pixel alphabet', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'blank_sign_backing.bbmodel').write_bytes((D/'shared_blank_sign_backing.bbmodel').read_bytes())
(D/'blank_sign_backing.geo.json').write_bytes((D/'shared_blank_sign_backing.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'weathered'],
    'textures': ['blank_sign_backing.png', 'blank_sign_backing_clean.png', 'blank_sign_backing_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'field_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Shared Blank sign backing complete and verified with 100% full coverage!")
