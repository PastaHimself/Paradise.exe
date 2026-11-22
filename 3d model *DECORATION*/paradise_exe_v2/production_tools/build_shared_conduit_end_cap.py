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

# Shared assets: Conduit end cap
# Terminal conduit pipe fitting and cap assembly with threaded collar, dome end plug, hex nut seal, and wall mounting bracket saddle; dimension recolors for iron, dark, and copper.

# 1. Pipe shaft (Y: 0.0 to 8.0, Z: 6.0 to 8.0)
c('pipe_shaft', [-1.0, 0.0, 6.0], [1.0, 8.0, 8.0], 'metal')

# 2. Wall mounting saddle (non-overlapping strap & ears)
c('saddle_strap', [-1.5, 3.0, 5.6], [1.5, 4.0, 6.0], 'metal_dark')
c('saddle_ear_l', [-1.8, 3.0, 6.0], [-1.0, 4.0, 8.0], 'metal_dark')
c('saddle_ear_r', [1.0, 3.0, 6.0], [1.8, 4.0, 8.0], 'metal_dark')

# 3. Threaded terminal collar (Y: 8.0 to 9.5)
c('collar_core', [-1.0, 8.0, 6.0], [1.0, 9.5, 8.0], 'metal')
c('collar_front', [-1.25, 8.0, 5.75], [1.25, 9.5, 6.0], 'metal_dark')
c('collar_back', [-1.25, 8.0, 8.0], [1.25, 9.5, 8.25], 'metal_dark')
c('collar_right', [1.0, 8.0, 6.0], [1.25, 9.5, 8.0], 'metal_dark')
c('collar_left', [-1.25, 8.0, 6.0], [-1.0, 9.5, 8.0], 'metal_dark')

# 4. Terminal end plug cap (Y: 9.5 to 10.5)
c('cap_plug', [-1.0, 9.5, 6.0], [1.0, 10.5, 8.0], 'metal')
c('cap_hex_nut', [-0.5, 10.5, 6.5], [0.5, 11.2, 7.5], 'metal_dark')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'copper': (32, 0, 'exposed_copper.png', 16, 16)
}

plan = {
    'reference': 'https://globalelectricsolar.com.pe/producto/tubo-conduit-emt/, https://www.ebay.co.uk/itm/325104414035',
    'used': 'shared assets conduit end cap terminal conduit pipe fitting and cap assembly with threaded collar, dome end plug, hex nut seal, and wall mounting bracket saddle; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular conduit end cap fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, exposed_copper pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('conduit_end_cap', cs, a, regions, plan, area='shared')

checker(D, [0, 6.0, 7.0], [12, 16, 12])
views(D, [0, 6.0, 7.0], {
    'front': [0, 6.0, 18],
    'three_quarter': [12, 10, 14],
    'back': [-12, 10, -4],
    'gameplay_scale': [18, 14, 20],
    'cap_close': [0, 9.5, 12.0],
    'saddle_close': [0, 3.5, 12.0]
})

# Create dark & copper texture variants
# Dark recolor
im_dark = Image.open(D/'conduit_end_cap.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'conduit_end_cap_dark.png')

# Copper recolor
im_copper = Image.open(D/'conduit_end_cap.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'conduit_end_cap_copper.png')

(D/'conduit_end_cap_iron.png').write_bytes((D/'conduit_end_cap.png').read_bytes())

call('create_texture', {'name': 'conduit_end_cap_dark', 'data': str(D/'conduit_end_cap_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'conduit_end_cap_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 6.0, 7.0], {
        'front_dark': [0, 6.0, 18],
        'three_quarter_dark': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'conduit_end_cap_copper', 'data': str(D/'conduit_end_cap_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'conduit_end_cap_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 6.0, 7.0], {
        'front_copper': [0, 6.0, 18],
        'three_quarter_copper': [12, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('conduit_end_cap', 'Conduit end cap', 'Fuse box', 'Switch plate', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'conduit_end_cap.bbmodel').write_bytes((D/'shared_conduit_end_cap.bbmodel').read_bytes())
(D/'conduit_end_cap.geo.json').write_bytes((D/'shared_conduit_end_cap.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['conduit_end_cap.png', 'conduit_end_cap_iron.png', 'conduit_end_cap_dark.png', 'conduit_end_cap_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'cap_close.png', 'saddle_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Conduit end cap complete and verified with 100% full coverage!")
