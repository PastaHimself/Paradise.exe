import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Catacombs: Skull niche
# 1. Architecture (Y: 0.0 to 16.0)
c('base_wall', [-9.0, 0.0, -4.0], [9.0, 3.0, 4.0], 'ashlar_stone')
c('jamb_l', [-9.0, 3.0, -4.0], [-6.0, 13.0, 4.0], 'ashlar_stone')
c('jamb_r', [6.0, 3.0, -4.0], [9.0, 13.0, 4.0], 'ashlar_stone')
c('back_wall', [-6.0, 3.0, -4.0], [6.0, 13.0, -2.5], 'cracked_stone')
c('shelf_slab', [-6.0, 3.0, -2.5], [6.0, 3.8, 4.5], 'cracked_stone')
c('top_lintel', [-9.0, 13.0, -4.0], [9.0, 16.0, 4.0], 'ashlar_stone')

# 2. Corbel brackets
c('corbel_l', [-7.0, 1.0, 4.0], [-5.5, 3.0, 4.8], 'carved_stone')
c('corbel_r', [5.5, 1.0, 4.0], [7.0, 3.0, 4.8], 'carved_stone')

# 3. Skull 1 (Left)
c('skull1_cranium', [-5.2, 3.8, -1.0], [-2.4, 6.4, 1.8], 'bone_relic')
c('skull1_mandible', [-4.8, 3.8, 1.8], [-2.8, 4.8, 2.6], 'bone_relic')

# 4. Skull 2 (Center)
c('skull2_cranium', [-1.4, 3.8, -0.6], [1.4, 6.6, 2.2], 'bone_relic')
c('skull2_mandible', [-1.0, 3.8, 2.2], [1.0, 4.9, 3.0], 'bone_relic')

# 5. Skull 3 (Right)
c('skull3_cranium', [2.4, 3.8, -1.2], [5.2, 6.4, 1.6], 'bone_relic')
c('skull3_mandible', [2.8, 3.8, 1.6], [4.8, 4.8, 2.4], 'bone_relic')

# 6. Bone chips on shelf
c('bone_fragment_1', [-5.5, 3.8, 2.8], [-4.0, 4.5, 4.0], 'bone_relic')
c('bone_fragment_2', [1.5, 3.8, 3.0], [2.5, 4.4, 4.2], 'bone_relic')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'bone_relic': (48, 0, 'bone_block_side.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/catacombs-wall-skulls-niche, https://www.alamy.com/stock-photo/crypt-skull-ossuary-shelf.html',
    'used': 'ancient subterranean catacombs skull niche wall loculus crypt ossuary shelf displaying three weathered crania relics with articulated mandibles and bone fragments resting in a deep stone wall alcove',
    'limitations': [
        'modular 18-unit wide wall ossuary skull niche fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, bone_block_side pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('skull_niche', cs, a, regions, plan, area='catacombs')

checker(D, [0, 8.0, 0], [22, 20, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 8.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 20, 26],
    'skulls_close': [0, 6.0, 8.0],
    'shelf_close': [-3.0, 5.0, 8.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'skull_niche.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'skull_niche_damp.png')
(D/'skull_niche_dry.png').write_bytes((D/'skull_niche.png').read_bytes())

call('create_texture', {'name': 'skull_niche_damp', 'data': str(D/'skull_niche_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'skull_niche_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_damp': [0, 8.0, 20],
        'three_quarter_damp': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('skull_niche', 'Skull niche', 'Bone shelf', 'Closed sarcophagus', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['skull_niche.png', 'skull_niche_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'skulls_close.png', 'shelf_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Skull niche complete and verified with 100% full coverage!")
