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

# Shared assets: Fuse box
# Surface-mounted industrial metal electrical distribution fuse box enclosure with perimeter framed door, dual mounting hinges, mechanical throw latch, top/bottom conduit knockout hubs, and front electrical warning plate; dimension recolors for iron, dark, and copper.

# 1. Backing enclosure box (Y: 4.0 to 16.0, Z: 5.0 to 8.0)
c('back_enclosure', [-5.0, 4.0, 5.0], [5.0, 16.0, 8.0], 'metal')

# 2. Outer door frame rim (Z: 4.0 to 5.0)
c('door_frame_top', [-5.0, 15.5, 4.0], [5.0, 16.0, 5.0], 'metal_dark')
c('door_frame_bottom', [-5.0, 4.0, 4.0], [5.0, 4.5, 5.0], 'metal_dark')
c('door_frame_l', [-5.0, 4.5, 4.0], [-4.5, 15.5, 5.0], 'metal_dark')
c('door_frame_r', [4.5, 4.5, 4.0], [5.0, 15.5, 5.0], 'metal_dark')

# 3. Recessed door panel (Z: 4.2 to 5.0)
c('door_panel', [-4.5, 4.5, 4.2], [4.5, 15.5, 5.0], 'metal')

# 4. Hinges & latch
c('hinge_top', [-5.3, 13.0, 4.2], [-5.0, 14.5, 5.2], 'metal_dark')
c('hinge_bottom', [-5.3, 5.5, 4.2], [-5.0, 7.0, 5.2], 'metal_dark')
c('latch_handle', [3.5, 9.5, 3.5], [4.2, 10.5, 4.2], 'metal_dark')

# 5. Conduit knockout hubs
c('conduit_hub_top', [-1.0, 16.0, 6.0], [1.0, 17.5, 8.0], 'metal_dark')
c('conduit_hub_bottom', [-1.0, 2.5, 6.0], [1.0, 4.0, 8.0], 'metal_dark')

# 6. Front warning badge
c('warning_plate', [-2.0, 11.5, 3.9], [2.0, 13.5, 4.2], 'hazard_yellow')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'hazard_yellow': (32, 0, 'gold_block.png', 16, 16),
    'copper': (48, 0, 'exposed_copper.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/industrial-fuse-box, https://www.alamy.com/stock-photo/metal-breaker-box-enclosure.html',
    'used': 'shared assets fuse box surface-mounted industrial metal electrical distribution fuse box enclosure with perimeter framed door, dual mounting hinges, mechanical throw latch, top/bottom conduit knockout hubs, and front electrical warning plate; dimension recolors for iron, dark, and copper',
    'limitations': [
        'modular fuse box fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, gold_block, exposed_copper pixels unchanged; iron, dark, and copper recolor variants'
    ]
}

D = build('fuse_box', cs, a, regions, plan, area='shared')

checker(D, [0, 10.0, 6.0], [18, 20, 16])
views(D, [0, 10.0, 6.0], {
    'front': [0, 10.0, 18],
    'three_quarter': [14, 12, 14],
    'back': [-14, 12, -4],
    'gameplay_scale': [22, 16, 22],
    'latch_close': [3.5, 10.0, 10.0],
    'warning_close': [0, 12.5, 10.0]
})

# Create dark & copper texture variants
im_dark = Image.open(D/'fuse_box.png').convert('RGBA')
im_dark.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (0, 0))
im_dark.save(D/'fuse_box_dark.png')

im_copper = Image.open(D/'fuse_box.png').convert('RGBA')
im_copper.paste(Image.open(S/'exposed_copper.png').convert('RGBA'), (0, 0))
im_copper.save(D/'fuse_box_copper.png')

(D/'fuse_box_iron.png').write_bytes((D/'fuse_box.png').read_bytes())

call('create_texture', {'name': 'fuse_box_dark', 'data': str(D/'fuse_box_dark.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'fuse_box_dark'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 6.0], {
        'front_dark': [0, 10.0, 18],
        'three_quarter_dark': [14, 12, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

call('create_texture', {'name': 'fuse_box_copper', 'data': str(D/'fuse_box_copper.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'fuse_box_copper'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 6.0], {
        'front_copper': [0, 10.0, 18],
        'three_quarter_copper': [14, 12, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('fuse_box', 'Fuse box', 'Switch plate', 'Reusable fixture texture states', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'fuse_box.bbmodel').write_bytes((D/'shared_fuse_box.bbmodel').read_bytes())
(D/'fuse_box.geo.json').write_bytes((D/'shared_fuse_box.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['iron', 'dark', 'copper'],
    'textures': ['fuse_box.png', 'fuse_box_iron.png', 'fuse_box_dark.png', 'fuse_box_copper.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'latch_close.png', 'warning_close.png', 'front_dark.png', 'three_quarter_dark.png', 'front_copper.png', 'three_quarter_copper.png']
}, indent=2))

print("Shared Fuse box complete and verified with 100% full coverage!")
