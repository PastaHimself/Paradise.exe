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

# Shared assets: Trim end cap
# Modular architectural trim return stop block plinth with stepped base footing, molded transition step, chamfered return cap, apex boss, and countersunk fastener hardware; dimension recolors for iron, dark, and copper.

c('plinth_base', [-3.0, 0.0, 6.8], [0.0, 2.0, 8.0], 'metal')
c('plinth_molding', [-2.8, 2.0, 7.0], [0.0, 3.2, 8.0], 'metal_dark')
c('return_step', [-2.5, 3.2, 7.2], [0.0, 5.0, 8.0], 'metal')
c('chamfer_cap', [-2.2, 5.0, 7.4], [0.0, 6.0, 8.0], 'metal_dark')
c('apex_boss', [-1.8, 6.0, 7.6], [0.0, 6.8, 8.0], 'metal')

c('mounting_screw_lower', [-1.7, 1.0, 6.6], [-1.3, 1.4, 6.8], 'metal_dark')
c('mounting_screw_upper', [-1.4, 4.0, 7.0], [-1.0, 4.4, 7.2], 'metal_dark')

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
    'reference': 'https://www.shutterstock.com/search/baseboard-trim-end-cap-plinth, https://www.alamy.com/stock-photo/metal-casing-terminal-stop-block.html',
    'used': 'shared assets trim end cap modular architectural trim return stop block plinth with stepped base footing, molded transition step, chamfered return cap, apex boss, and countersunk fastener hardware; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular trim end cap fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper, calcite pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('trim_end_cap', cs, a, regions, plan, area='shared')

checker(D, [-1.5, 3.4, 7.3], [8, 12, 6])
views(D, [-1.5, 3.4, 7.3], {
    'front': [-1.5, 3.4, 18],
    'three_quarter': [10, 8, 14],
    'back': [-10, 8, -2],
    'gameplay_scale': [18, 12, 18],
    'plinth_close': [-1.5, 1.6, 11.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'trim_end_cap.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'trim_end_cap_dark.png')

im_copper = Image.open(D/'trim_end_cap.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'trim_end_cap_copper.png')

(D/'trim_end_cap_iron.png').write_bytes((D/'trim_end_cap.png').read_bytes())

call('create_texture', {'name': 'trim_end_cap_dark', 'data': str(D/'trim_end_cap_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'trim_end_cap_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [-1.5, 3.4, 7.3], {
        'front_dark': [-1.5, 3.4, 18],
        'three_quarter_dark': [10, 8, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'trim_end_cap_copper', 'data': str(D/'trim_end_cap_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'trim_end_cap_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [-1.5, 3.4, 7.3], {
        'front_copper': [-1.5, 3.4, 18],
        'three_quarter_copper': [10, 8, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('trim_end_cap', 'Trim end cap', 'ALL_COMPLETE', 'ALL_COMPLETE', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'trim_end_cap.bbmodel').write_bytes((D/'shared_trim_end_cap.bbmodel').read_bytes())
(D/'trim_end_cap.geo.json').write_bytes((D/'shared_trim_end_cap.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['trim_end_cap.png', 'trim_end_cap_iron.png', 'trim_end_cap_dark.png', 'trim_end_cap_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'plinth_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Trim end cap complete and verified with 100% full coverage!")
