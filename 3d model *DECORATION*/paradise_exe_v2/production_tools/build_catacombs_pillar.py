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

# Catacombs: Pillar
# Freestanding heavy ashlar stone masonry pier supporting vaulted ceiling bays.
# 1. Base / Plinths (Y: 0.0 to 2.5)
c('sub_plinth', [-5.5, 0.0, -5.5], [5.5, 1.2, 5.5], 'ashlar_stone', off=['down', 'up'])
c('plinth_torus', [-4.8, 1.2, -4.8], [4.8, 2.5, 4.8], 'cracked_stone', off=['down', 'up'])

# 2. Main Column Shaft (Y: 2.5 to 19.5)
c('shaft_core', [-4.0, 2.5, -4.0], [4.0, 19.5, 4.0], 'ashlar_stone', off=['down', 'up'])

# Engaged decorative pilaster ribs on 4 sides (attached to shaft)
c('rib_south', [-2.5, 3.5, 4.0], [2.5, 18.5, 4.6], 'cracked_stone', off=['north', 'down', 'up'])
c('rib_north', [-2.5, 3.5, -4.6], [2.5, 18.5, -4.0], 'cracked_stone', off=['south', 'down', 'up'])
c('rib_east', [4.0, 3.5, -2.5], [4.6, 18.5, 2.5], 'cracked_stone', off=['west', 'down', 'up'])
c('rib_west', [-4.6, 3.5, -2.5], [-4.0, 18.5, 2.5], 'cracked_stone', off=['east', 'down', 'up'])

# 3. Capital (Y: 19.5 to 22.2)
c('astragal_neck', [-4.5, 19.5, -4.5], [4.5, 20.2, 4.5], 'ashlar_stone', off=['down', 'up'])
c('echinus_carved', [-5.0, 20.2, -5.0], [5.0, 21.2, 5.0], 'carved_stone', off=['down', 'up'])
c('abacus_slab', [-5.6, 21.2, -5.6], [5.6, 22.2, 5.6], 'ashlar_stone', off=['down', 'up'])

# 4. Four-way Vault Springers (Y: 22.2 to 25.0)
c('springer_hub', [-4.0, 22.2, -4.0], [4.0, 25.0, 4.0], 'carved_stone', off=['down'])
c('springer_south', [-2.8, 22.2, 4.0], [2.8, 24.5, 6.8], 'ashlar_stone', off=['north', 'down'])
c('springer_north', [-2.8, 22.2, -6.8], [2.8, 24.5, -4.0], 'ashlar_stone', off=['south', 'down'])
c('springer_east', [4.0, 22.2, -2.8], [6.8, 24.5, 2.8], 'ashlar_stone', off=['west', 'down'])
c('springer_west', [-6.8, 22.2, -2.8], [-4.0, 24.5, 2.8], 'ashlar_stone', off=['east', 'down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-stone-column-crypt-catacombs, https://www.alamy.com/stock-photo/underground-vault-pillar.html',
    'used': 'ancient subterranean catacombs freestanding ashlar masonry pillar column supporting four-way vaulted ceiling bays with stepped sub-plinth, chamfered torus, engaged pilaster ribs, chiseled capital, and cruciform vault springers',
    'limitations': [
        'modular 14x14 unit footprint pillar column fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, stonebrick_carved pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('pillar', cs, a, regions, plan, area='catacombs')

checker(D, [0, 12.5, 0], [18, 26, 18])
views(D, [0, 12.5, 0], {
    'front': [0, 12.5, 20],
    'three_quarter': [18, 18, 18],
    'back': [-18, 18, -18],
    'gameplay_scale': [26, 24, 26],
    'capital_close': [0, 21.0, 7.0],
    'base_close': [0, 2.0, 7.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'pillar.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'pillar_damp.png')
(D/'pillar_dry.png').write_bytes((D/'pillar.png').read_bytes())

call('create_texture', {'name': 'pillar_damp', 'data': str(D/'pillar_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'pillar_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.5, 0], {
        'front_damp': [0, 12.5, 20],
        'three_quarter_damp': [18, 18, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('pillar', 'Pillar', 'Low archway', 'Blocked arch with loose stones', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['pillar.png', 'pillar_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'capital_close.png', 'base_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Pillar complete and verified!")
