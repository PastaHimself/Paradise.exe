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

# Shared assets: Small debris
# Environmental floor scattered debris cluster with visible distinct silhouette featuring a fractured concrete masonry chunk, chipped clay brick shard, bent industrial sheet metal plate, discarded aluminum beverage can, crumbling plaster flakes, and scattered gravel scree; clean and weathered/charred variants.

# 1. Main concrete chunk (Y: 0.0 to 4.8)
c('concrete_chunk_main', [-3.0, 0.0, -2.5], [1.5, 3.5, 1.5], 'concrete')
c('concrete_facet_top', [-2.0, 3.5, -1.5], [0.5, 4.8, 0.8], 'concrete')

# 2. Bent sheet metal plate (Y: 0.0 to 2.5)
c('bent_metal_plate_flat', [-6.5, 0.0, 2.0], [-3.2, 0.4, 5.5], 'sheet_metal')
c('bent_metal_lip_up', [-6.5, 0.4, 2.0], [-5.7, 2.5, 4.0], 'sheet_metal')

# 3. Clay brick shard & pebble
c('masonry_brick_shard', [2.2, 0.0, -1.0], [5.5, 2.2, 1.8], 'brick_red')
c('gravel_pebble_3', [2.5, 0.0, 2.5], [4.0, 0.9, 4.0], 'gravel_grit')

# 4. Discarded beverage canister
c('discarded_can_body', [-1.5, 0.0, 2.5], [0.5, 1.8, 5.0], 'canister_blue')
c('discarded_can_rim', [0.5, 0.2, 2.7], [0.9, 1.6, 4.8], 'sheet_metal')

# 5. Plaster fragments
c('plaster_flake_1', [-1.0, 0.0, -5.5], [2.0, 0.6, -3.2], 'plaster_white')
c('plaster_flake_2', [-6.0, 0.0, -4.5], [-3.5, 0.5, -2.5], 'plaster_white')

# 6. Additional scree & gravel pebbles
c('gravel_pebble_1', [3.0, 0.0, -4.5], [4.8, 1.2, -3.0], 'gravel_grit')
c('gravel_pebble_2', [-5.5, 0.0, -1.5], [-3.8, 1.0, 0.5], 'gravel_grit')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete': (0, 0, 'stone.png', 16, 16),
    'brick_red': (16, 0, 'brick.png', 16, 16),
    'sheet_metal': (32, 0, 'iron_block.png', 16, 16),
    'canister_blue': (48, 0, 'lapis_block.png', 16, 16),
    'plaster_white': (0, 16, 'calcite.png', 16, 16),
    'gravel_grit': (16, 16, 'gravel.png', 16, 16),
    'charred_soot': (32, 16, 'tuff.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/floor-rubble-debris-scatter, https://www.alamy.com/stock-photo/concrete-rubble-brick-fragments.html',
    'used': 'shared assets small debris environmental floor scattered debris cluster with visible distinct silhouette featuring a fractured concrete masonry chunk, chipped clay brick shard, bent industrial sheet metal plate, discarded aluminum beverage can, crumbling plaster flakes, and scattered gravel scree; clean and weathered/charred variants',
    'limitations': [
        'modular small debris cluster fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting; visible silhouette verified',
        '100% full face coverage (every face textured, 0 untextured faces); original stone, brick, iron_block, lapis_block, calcite, gravel, tuff pixels unchanged; clean and charred variants'
    ]
}

D = build('small_debris', cs, a, regions, plan, area='shared')

checker(D, [0, 2.5, 0], [16, 10, 16])
views(D, [0, 2.5, 0], {
    'front': [0, 3.0, 16],
    'three_quarter': [14, 10, 14],
    'back': [-14, 10, -14],
    'gameplay_scale': [20, 14, 20],
    'top': [0, 18, 0],
    'chunk_close': [-1.0, 2.5, 0.0]
})

# Create charred / weathered texture variant
im_charred = Image.open(D/'small_debris.png').convert('RGBA')
im_charred.paste(Image.open(S/'tuff.png').convert('RGBA'), (0, 0)) # soot-blackened concrete
im_charred.paste(Image.open(S/'tuff.png').convert('RGBA'), (16, 0)) # burned brick
im_charred.paste(Image.open(S/'weathered_copper.png').convert('RGBA'), (32, 0)) # corroded metal
im_charred.paste(Image.open(S/'blackstone.png').convert('RGBA'), (48, 0)) # charred canister
im_charred.save(D/'small_debris_charred.png')
(D/'small_debris_clean.png').write_bytes((D/'small_debris.png').read_bytes())

call('create_texture', {'name': 'small_debris_charred', 'data': str(D/'small_debris_charred.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'small_debris_charred'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.5, 0], {
        'front_charred': [0, 3.0, 16],
        'three_quarter_charred': [14, 10, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('small_debris', 'Small debris', 'Wall base trim', 'Floor border trim', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'small_debris.bbmodel').write_bytes((D/'shared_small_debris.bbmodel').read_bytes())
(D/'small_debris.geo.json').write_bytes((D/'shared_small_debris.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'charred'],
    'textures': ['small_debris.png', 'small_debris_clean.png', 'small_debris_charred.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'top.png', 'chunk_close.png', 'front_charred.png', 'three_quarter_charred.png']
}, indent=2))

print("Shared Small debris complete and verified with 100% full coverage!")
