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

# Catacombs: Rubble pile
# Substantial tumbled scree mound of fallen ashlar blocks, cracked voussoirs, fractured stone chunks, lime mortar crusts, and loose gravel

# 1. Base scree apron & gravel tongues (Y: 0.0 to 1.2)
c('apron_center', [-7.0, 0.0, -7.0], [7.0, 1.2, 7.0], 'gravel_scree')
c('tongue_n', [-4.0, 0.0, -9.0], [4.0, 0.8, -7.0], 'gravel_scree')
c('tongue_s', [-5.0, 0.0, 7.0], [3.0, 0.8, 9.0], 'gravel_scree')
c('tongue_w', [-9.0, 0.0, -3.0], [-7.0, 0.8, 4.0], 'gravel_scree')
c('tongue_e', [7.0, 0.0, -4.0], [9.0, 0.8, 3.0], 'gravel_scree')

# 2. Main dislodged dressed stone blocks (resting on apron_center, Y >= 1.2)
c('block_main', [-5.0, 1.2, -2.0], [0.0, 5.2, 1.0], 'ashlar_stone')
c('block_cracked', [0.0, 1.2, -1.8], [5.0, 4.8, 3.5], 'cracked_stone')
c('block_rear', [-2.5, 1.2, -6.5], [3.5, 4.0, -2.0], 'ashlar_stone')
c('block_front', [-4.0, 1.2, 1.0], [0.0, 3.6, 5.5], 'cracked_stone')

# 3. Upper tier stones & apex rubble (Y >= 4.0..5.2)
c('apex_voussoir', [-2.0, 5.2, -2.0], [1.5, 8.5, 1.5], 'ashlar_stone')
c('apex_top_facet', [-1.5, 8.5, -1.5], [1.2, 10.5, 1.0], 'cracked_stone')
c('spall_stone', [-4.5, 5.2, -1.5], [-2.0, 7.0, 0.8], 'cracked_stone')
c('shoulder_stone', [1.5, 4.0, -4.5], [3.5, 6.5, -1.8], 'ashlar_stone')

# 4. Lime mortar crusts & scattered pebbles (resting on apron at Y=1.2)
c('mortar_nw', [-6.0, 1.2, -6.0], [-4.0, 2.5, -4.0], 'lime_mortar')
c('mortar_ne', [4.0, 1.2, -5.5], [6.0, 2.4, -3.5], 'lime_mortar')
c('pebble_sw', [-6.5, 1.2, 3.0], [-5.0, 2.2, 4.8], 'cracked_stone')
c('pebble_se', [3.5, 1.2, 4.0], [5.5, 2.6, 6.0], 'cracked_stone')
c('crumb_mid', [-2.8, 3.6, 2.0], [-0.8, 4.8, 3.4], 'lime_mortar')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'gravel_scree': (32, 0, 'gravel.png', 16, 16),
    'lime_mortar': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/collapsed-stone-rubble-pile-ruins, https://www.alamy.com/stock-photo/dungeon-crypt-stone-rubble-mound.html',
    'used': 'ancient subterranean catacombs rubble pile tumbled stone scree mound featuring dislodged ashlar blocks, cracked vault voussoirs, fractured stone spalls, lime mortar bedding crusts, and loose gravel scree apron',
    'limitations': [
        'modular 18-unit wide rubble scree mound fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, gravel, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('rubble_pile', cs, a, regions, plan, area='catacombs')

checker(D, [0, 5.0, 0], [20, 22, 20])
views(D, [0, 5.0, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 20, 24],
    'apex_close': [0, 8.0, 8.0],
    'scree_close': [3.0, 3.0, 8.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'rubble_pile.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'rubble_pile_damp.png')
(D/'rubble_pile_dry.png').write_bytes((D/'rubble_pile.png').read_bytes())

call('create_texture', {'name': 'rubble_pile_damp', 'data': str(D/'rubble_pile_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'rubble_pile_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 5.0, 0], {
        'front_damp': [0, 6.0, 18],
        'three_quarter_damp': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('rubble_pile', 'Rubble pile', 'Broken coffin board', 'Mineral streaks', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['rubble_pile.png', 'rubble_pile_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'apex_close.png', 'scree_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Rubble pile complete and verified with 100% full coverage!")
