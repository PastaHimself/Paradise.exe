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

# Shared assets: Door frame trim
# Modular 18-unit vertical architectural doorway architrave casing moulding with stepped backband, channeled mid-step, projecting front nose bead, and dual wall reveal channels; dimension recolors for iron, dark, and copper.

c('casing_backband', [-1.8, 0.0, 7.5], [1.8, 18.0, 8.0], 'metal')
c('casing_mid_step', [-1.4, 0.0, 7.0], [1.4, 18.0, 7.5], 'metal_dark')
c('casing_front_nose', [-0.8, 0.0, 6.5], [0.8, 18.0, 7.0], 'metal')
c('reveal_r', [1.4, 0.0, 7.2], [1.8, 18.0, 7.5], 'metal_dark')
c('reveal_l', [-1.8, 0.0, 7.2], [-1.4, 18.0, 7.5], 'metal_dark')

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
    'reference': 'https://www.shutterstock.com/search/commercial-door-casing-moulding, https://www.alamy.com/stock-photo/metal-door-frame-architrave-trim.html',
    'used': 'shared assets door frame trim modular 18-unit vertical architectural doorway architrave casing moulding with stepped backband, channeled mid-step, projecting front nose bead, and dual wall reveal channels; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular door frame trim fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper, calcite pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('door_frame_trim', cs, a, regions, plan, area='shared')

checker(D, [0, 9.0, 7.2], [10, 22, 8])
views(D, [0, 9.0, 7.2], {
    'front': [0, 9.0, 18],
    'three_quarter': [12, 11, 14],
    'back': [-12, 11, -2],
    'gameplay_scale': [20, 14, 20],
    'profile_close': [0, 9.0, 11.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'door_frame_trim.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'door_frame_trim_dark.png')

im_copper = Image.open(D/'door_frame_trim.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'door_frame_trim_copper.png')

(D/'door_frame_trim_iron.png').write_bytes((D/'door_frame_trim.png').read_bytes())

call('create_texture', {'name': 'door_frame_trim_dark', 'data': str(D/'door_frame_trim_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'door_frame_trim_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 7.2], {
        'front_dark': [0, 9.0, 18],
        'three_quarter_dark': [12, 11, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'door_frame_trim_copper', 'data': str(D/'door_frame_trim_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'door_frame_trim_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 7.2], {
        'front_copper': [0, 9.0, 18],
        'three_quarter_copper': [12, 11, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('door_frame_trim', 'Door frame trim', 'Trim end cap', 'Shared complete', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'door_frame_trim.bbmodel').write_bytes((D/'shared_door_frame_trim.bbmodel').read_bytes())
(D/'door_frame_trim.geo.json').write_bytes((D/'shared_door_frame_trim.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['door_frame_trim.png', 'door_frame_trim_iron.png', 'door_frame_trim_dark.png', 'door_frame_trim_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'profile_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Door frame trim complete and verified with 100% full coverage!")
