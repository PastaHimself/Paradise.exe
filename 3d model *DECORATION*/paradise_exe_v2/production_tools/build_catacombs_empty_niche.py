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

# Catacombs: Empty niche
# 1. Base footing / wall under shelf (Y: 0.0 to 3.0)
c('base_wall', [-8.0, 0.0, -4.0], [8.0, 3.0, 4.0], 'ashlar_stone')

# 2. Side jamb piers (Y: 3.0 to 13.0)
c('jamb_l', [-8.0, 3.0, -4.0], [-5.0, 13.0, 4.0], 'ashlar_stone')
c('jamb_r', [5.0, 3.0, -4.0], [8.0, 13.0, 4.0], 'ashlar_stone')

# 3. Recessed Back wall (Y: 3.0 to 13.0, Z: -4.0 to -2.5)
c('back_wall', [-5.0, 3.0, -4.0], [5.0, 13.0, -2.5], 'cracked_stone')

# 4. Top wall beam overhead (Y: 13.0 to 16.0)
c('top_lintel', [-8.0, 13.0, -4.0], [8.0, 16.0, 4.0], 'ashlar_stone')

# 5. Loculus shelf floor slab (Y: 3.0 to 3.8, Z: -2.5 to 4.5)
c('shelf_slab', [-5.0, 3.0, -2.5], [5.0, 3.8, 4.5], 'cracked_stone')

# 6. Adhering lime mortar remnants from broken sealing slab
c('mortar_left', [-5.0, 3.8, 2.5], [-3.5, 4.3, 3.8], 'lime_mortar')
c('mortar_right', [3.5, 3.8, 2.5], [5.0, 4.3, 3.8], 'lime_mortar')
c('mortar_corner', [-3.8, 3.8, -2.2], [-2.6, 4.3, -1.2], 'lime_mortar')

# 7. Shelf corbel brackets (protruding forward at Z: 4.0 to 4.8)
c('corbel_l', [-6.0, 1.0, 4.0], [-4.5, 3.0, 4.8], 'carved_stone')
c('corbel_r', [4.5, 1.0, 4.0], [6.0, 3.0, 4.8], 'carved_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'lime_mortar': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/catacomb-empty-burial-niche-loculus, https://www.alamy.com/stock-photo/ancient-crypt-wall-shelf.html',
    'used': 'ancient subterranean catacombs empty niche recessed burial loculus carved into ashlar masonry wall with deep interior cavity, protruding shelf slab, chipped lime mortar crusts from unsealed closure, and carved supporting corbel brackets',
    'limitations': [
        'modular 16-unit wide wall loculus niche fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('empty_niche', cs, a, regions, plan, area='catacombs')

checker(D, [0, 8.0, 0], [22, 20, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 8.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 20, 26],
    'cavity_close': [0, 8.0, 6.0],
    'mortar_close': [-4.0, 4.5, 6.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'empty_niche.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.paste(Image.open(S/'calcite.png').convert('RGBA'), (48, 0))
im_mossy.save(D/'empty_niche_damp.png')
(D/'empty_niche_dry.png').write_bytes((D/'empty_niche.png').read_bytes())

call('create_texture', {'name': 'empty_niche_damp', 'data': str(D/'empty_niche_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'empty_niche_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_damp': [0, 8.0, 20],
        'three_quarter_damp': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('empty_niche', 'Empty niche', 'Skull niche', 'Bone shelf', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['empty_niche.png', 'empty_niche_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'cavity_close.png', 'mortar_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Empty niche complete and verified with 100% full coverage!")
