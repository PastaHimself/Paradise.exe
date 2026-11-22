import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# Catacombs: Corner pier
# L-shaped masonry pier supporting vaulted ceiling at hallway corners.
# Bounding box: X: [-8.0, 5.0], Y: [0.0, 24.0], Z: [-8.0, 5.0]

# 1. Plinths (Y: 0.0 to 2.0)
c('plinth_core', [-8.0, 0.0, -8.0], [-1.0, 2.0, -1.0], 'ashlar_stone', off=['down', 'up'])
c('plinth_east', [-1.0, 0.0, -8.0], [5.0, 2.0, -2.5], 'ashlar_stone', off=['down', 'up', 'west'])
c('plinth_south', [-8.0, 0.0, -1.0], [-2.5, 2.0, 5.0], 'ashlar_stone', off=['down', 'up', 'north'])

# 2. Pier Shafts (Y: 2.0 to 18.0)
c('shaft_core', [-7.5, 2.0, -7.5], [-1.5, 18.0, -1.5], 'ashlar_stone', off=['down', 'up'])
c('shaft_east', [-1.5, 2.0, -7.0], [4.5, 18.0, -3.0], 'cracked_stone', off=['down', 'up', 'west'])
c('shaft_south', [-7.0, 2.0, -1.5], [-3.0, 18.0, 4.5], 'cracked_stone', off=['down', 'up', 'north'])

# 3. Impost Capitals / Molded Cornice (Y: 18.0 to 19.5)
c('impost_core', [-8.0, 18.0, -8.0], [-1.0, 19.5, -1.0], 'carved_stone', off=['down', 'up'])
c('impost_east', [-1.0, 18.0, -7.5], [5.0, 19.5, -2.5], 'carved_stone', off=['down', 'up', 'west'])
c('impost_south', [-7.5, 18.0, -1.0], [-2.5, 19.5, 5.0], 'carved_stone', off=['down', 'up', 'north'])

# 4. Vault Springers (Y: 19.5 to 24.0)
# East springing arch block
c('springer_east_1', [0.0, 19.5, -6.5], [4.5, 21.5, -3.5], 'ashlar_stone', off=['down', 'up', 'west'])
c('springer_east_2', [2.0, 21.5, -6.5], [5.5, 23.5, -3.5], 'ashlar_stone', off=['down', 'west'])

# South springing arch block
c('springer_south_1', [-6.5, 19.5, 0.0], [-3.5, 21.5, 4.5], 'ashlar_stone', off=['down', 'up', 'north'])
c('springer_south_2', [-6.5, 21.5, 2.0], [-3.5, 23.5, 5.5], 'ashlar_stone', off=['down', 'north'])

# Diagonal groin / vault rib springing block
c('springer_diag_1', [-5.5, 19.5, -5.5], [-1.5, 22.0, -1.5], 'cracked_stone', off=['down', 'up'])
c('springer_diag_2', [-4.0, 22.0, -4.0], [0.5, 24.0, 0.5], 'cracked_stone', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/catacomb-corner-pillar, https://www.alamy.com/stock-photo/crypt-junction-stone-pier.html',
    'used': 'ancient subterranean catacombs corner pier massive L-shaped ashlar stone masonry pier supporting vaulted ceiling intersections with molded plinth bases, multi-tier pilasters, carved impost capitals, and triple vault springers heading east, south, and diagonally',
    'limitations': [
        'modular 13x13 unit footprint corner pier fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, stonebrick_carved pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('corner_pier', cs, a, regions, plan, area='catacombs')

checker(D, [-1.5, 12.0, -1.5], [20, 26, 20])
views(D, [-1.5, 12.0, -1.5], {
    'front': [-1.5, 12.0, 20],
    'three_quarter': [18, 18, 18],
    'back': [-18, 18, -18],
    'gameplay_scale': [26, 24, 26],
    'impost_close': [-1.5, 19.0, 6.0],
    'springer_close': [-1.5, 22.0, 6.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'corner_pier.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'corner_pier_damp.png')
(D/'corner_pier_dry.png').write_bytes((D/'corner_pier.png').read_bytes())

call('create_texture', {'name': 'corner_pier_damp', 'data': str(D/'corner_pier_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'corner_pier_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [-1.5, 12.0, -1.5], {
        'front_damp': [-1.5, 12.0, 20],
        'three_quarter_damp': [18, 18, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('corner_pier', 'Corner pier', 'Pillar', 'Low archway', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['corner_pier.png', 'corner_pier_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'impost_close.png', 'springer_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Corner pier complete and verified!")
