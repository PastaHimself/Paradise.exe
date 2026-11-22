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

# Catacombs: Fallen masonry
# Structural vault collapse cluster of dislodged wedge voussoirs, fractured header blocks, spall chips, exposed lime mortar, and a rusted iron masonry clamp

# 1. Impact floor spall apron (Y: 0.0 to 0.8)
c('apron_center', [-6.0, 0.0, -6.0], [6.0, 0.8, 6.0], 'gravel_scree')
c('tongue_n', [-3.0, 0.0, -8.0], [3.0, 0.6, -6.0], 'gravel_scree')
c('tongue_s', [-4.0, 0.0, 6.0], [2.0, 0.6, 8.0], 'gravel_scree')
c('tongue_e', [6.0, 0.0, -2.0], [7.5, 0.5, 3.0], 'gravel_scree')

# 2. Primary dislodged arch voussoir stone (stepped wedge tiers, resting on apron at Y=0.8)
c('voussoir1_base', [-5.0, 0.8, -3.5], [0.5, 4.8, 2.5], 'ashlar_stone')
c('voussoir1_mid', [-4.5, 4.8, -2.8], [-0.2, 8.2, 1.8], 'cracked_stone')
c('voussoir1_top', [-3.8, 8.2, -1.8], [-0.8, 10.6, 0.8], 'ashlar_stone')

# 3. Secondary voussoir block (resting on apron at Y=0.8)
c('voussoir2_base', [0.5, 0.8, -1.5], [5.5, 4.2, 3.8], 'cracked_stone')
c('voussoir2_top', [1.2, 4.2, -0.8], [4.8, 6.8, 2.8], 'ashlar_stone')

# 4. Rusted forged iron masonry cramp dog
c('clamp_shank', [-2.8, 10.6, -0.6], [-1.8, 11.0, 0.6], 'iron_clamp')
c('clamp_bar', [-1.8, 10.6, -0.2], [1.2, 11.0, 0.2], 'iron_clamp')
c('clamp_lug', [1.2, 6.8, -0.2], [1.5, 11.0, 0.2], 'iron_clamp')

# 5. Fractured spalls & shattered chunks (resting on apron at Y=0.8)
c('spall_rear', [0.5, 0.8, -5.5], [3.0, 3.2, -1.5], 'ashlar_stone')
c('spall_front', [-4.2, 0.8, 2.5], [-1.8, 2.6, 5.2], 'cracked_stone')
c('flake_west', [-5.8, 0.8, -1.5], [-5.0, 2.2, 1.5], 'cracked_stone')
c('chip_east', [2.5, 0.8, 4.0], [4.5, 2.0, 5.5], 'ashlar_stone')

# 6. Exposed lime mortar bedding crusts adhering to stone flanks
c('mortar_west', [-5.3, 0.8, -3.5], [-5.0, 3.5, -1.5], 'lime_mortar')
c('mortar_ne', [3.5, 0.8, -4.5], [5.2, 2.0, -2.5], 'lime_mortar')
c('mortar_mid', [-0.2, 4.8, -2.0], [0.5, 5.8, -0.5], 'lime_mortar')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'gravel_scree': (32, 0, 'gravel.png', 16, 16),
    'lime_mortar': (48, 0, 'calcite.png', 16, 16),
    'iron_clamp': (0, 16, 'cauldron_side.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/collapsed-stone-vault-arch-masonry, https://www.alamy.com/stock-photo/ancient-ruins-fallen-arch-voussoirs.html',
    'used': 'ancient subterranean catacombs fallen masonry vault voussoir cluster featuring dislodged wedge arch stones, fractured header blocks, crushed stone scree apron, adhering lime mortar crusts, and an exposed rusted forged iron masonry clamp dog',
    'limitations': [
        'modular 16-unit wide fallen masonry cluster fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, gravel, calcite, cauldron_side pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('fallen_masonry', cs, a, regions, plan, area='catacombs')

checker(D, [0, 5.5, 0], [20, 22, 20])
views(D, [0, 5.5, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 20, 24],
    'voussoir_close': [-2.0, 7.0, 8.0],
    'clamp_close': [0, 10.0, 6.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'fallen_masonry.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'fallen_masonry_damp.png')
(D/'fallen_masonry_dry.png').write_bytes((D/'fallen_masonry.png').read_bytes())

call('create_texture', {'name': 'fallen_masonry_damp', 'data': str(D/'fallen_masonry_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'fallen_masonry_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 5.5, 0], {
        'front_damp': [0, 6.0, 18],
        'three_quarter_damp': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('fallen_masonry', 'Fallen masonry', 'Carved arrows', 'Carved arrows', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['fallen_masonry.png', 'fallen_masonry_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'voussoir_close.png', 'clamp_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Fallen masonry complete and verified with 100% full coverage!")
