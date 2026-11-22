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

# Catacombs: Urn
# 1. Base pedestal
c('base_plinth', [-3.5, 0.0, -3.5], [3.5, 1.5, 3.5], 'ashlar_stone')

# 2. Urn Stem & Body
c('stem_neck', [-2.2, 1.5, -2.2], [2.2, 3.0, 2.2], 'urn_clay')
c('belly_widening', [-3.6, 3.0, -3.6], [3.6, 7.5, 3.6], 'urn_clay')
c('shoulder_taper', [-2.8, 7.5, -2.8], [2.8, 9.0, 2.8], 'urn_clay')
c('urn_lip', [-3.2, 9.0, -3.2], [3.2, 9.8, 3.2], 'carved_stone')

# 3. Urn Domed Lid & Finial
c('lid_rim', [-3.0, 9.8, -3.0], [3.0, 10.6, 3.0], 'carved_stone')
c('lid_dome', [-2.0, 10.6, -2.0], [2.0, 11.4, 2.0], 'carved_stone')
c('lid_finial', [-0.8, 11.4, -0.8], [0.8, 12.6, 0.8], 'carved_stone')

# 4. Twin Loop Handles (Left & Right)
c('handle_upper_l', [-4.4, 7.5, -0.6], [-2.8, 8.2, 0.6], 'carved_stone')
c('handle_loop_l', [-4.6, 4.8, -0.6], [-3.8, 7.5, 0.6], 'carved_stone')
c('handle_lower_l', [-4.2, 4.2, -0.6], [-3.6, 4.8, 0.6], 'carved_stone')

c('handle_upper_r', [2.8, 7.5, -0.6], [4.4, 8.2, 0.6], 'carved_stone')
c('handle_loop_r', [3.8, 4.8, -0.6], [4.6, 7.5, 0.6], 'carved_stone')
c('handle_lower_r', [3.6, 4.2, -0.6], [4.2, 4.8, 0.6], 'carved_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'carved_stone': (16, 0, 'stonebrick_carved.png', 16, 16),
    'urn_clay': (32, 0, 'hardened_clay.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-cinerary-urn-tomb-catacombs, https://www.alamy.com/stock-photo/antique-clay-cremation-urn.html',
    'used': 'ancient subterranean catacombs cinerary urn terracotta burial vessel resting on a molded stone pedestal with stepped flared belly, twin ornamental loop handles, molded lip collar, domed lid, and finial tip',
    'limitations': [
        'modular 10-unit wide burial cinerary urn fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_carved, hardened_clay pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('urn', cs, a, regions, plan, area='catacombs')

checker(D, [0, 6.0, 0], [16, 16, 16])
views(D, [0, 6.0, 0], {
    'front': [0, 6.0, 16],
    'three_quarter': [14, 12, 14],
    'back': [-14, 12, -14],
    'gameplay_scale': [20, 16, 20],
    'lid_close': [0, 10.5, 6.0],
    'handle_close': [-4.0, 6.5, 5.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'urn.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'urn_damp.png')
(D/'urn_dry.png').write_bytes((D/'urn.png').read_bytes())

call('create_texture', {'name': 'urn_damp', 'data': str(D/'urn_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'urn_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 6.0, 0], {
        'front_damp': [0, 6.0, 16],
        'three_quarter_damp': [14, 12, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('urn', 'Urn', 'Inscription slab', 'Candle cluster', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['urn.png', 'urn_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'lid_close.png', 'handle_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Urn complete and verified with 100% full coverage!")
