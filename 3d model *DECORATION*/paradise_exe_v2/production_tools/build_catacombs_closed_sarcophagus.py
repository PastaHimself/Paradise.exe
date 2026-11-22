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

# Catacombs: Closed sarcophagus
# 1. Base footing plinth (Y: 0.0 to 1.5)
c('base_plinth', [-11.5, 0.0, -6.5], [11.5, 1.5, 6.5], 'ashlar_stone')

# 2. Chest body (Y: 1.5 to 9.5)
c('chest_body', [-11.0, 1.5, -6.0], [11.0, 9.5, 6.0], 'ashlar_stone')

# 3. Side and End Carved Frieze Panels
c('frieze_front', [-9.5, 3.0, 6.0], [9.5, 8.0, 6.4], 'carved_stone')
c('frieze_back', [-9.5, 3.0, -6.4], [9.5, 8.0, -6.0], 'carved_stone')
c('frieze_l', [-11.4, 3.0, -4.5], [-11.0, 8.0, 4.5], 'carved_stone')
c('frieze_r', [11.0, 3.0, -4.5], [11.4, 8.0, 4.5], 'carved_stone')

# 4. Lid Molded Cornice (Y: 9.5 to 11.0)
c('lid_cornice', [-11.8, 9.5, -6.8], [11.8, 11.0, 6.8], 'ashlar_stone')

# 5. Lid Stepped Middle Tier (Y: 11.0 to 12.5)
c('lid_mid_tier', [-10.4, 11.0, -5.4], [10.4, 12.5, 5.4], 'cracked_stone')

# 6. Lid Gabled Top Ridge (Y: 12.5 to 14.0)
c('lid_ridge', [-9.5, 12.5, -4.0], [9.5, 14.0, 4.0], 'ashlar_stone')

# 7. Corner Acroteria at 4 lid corners (Y: 11.0 to 13.0, sitting on cornice corners)
c('acroterion_nw', [-11.8, 11.0, -6.8], [-10.5, 13.0, -5.5], 'carved_stone')
c('acroterion_ne', [10.5, 11.0, -6.8], [11.8, 13.0, -5.5], 'carved_stone')
c('acroterion_sw', [-11.8, 11.0, 5.5], [-10.5, 13.0, 6.8], 'carved_stone')
c('acroterion_se', [10.5, 11.0, 5.5], [11.8, 13.0, 6.8], 'carved_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-stone-sarcophagus-crypt-catacombs, https://www.alamy.com/stock-photo/medieval-tomb-closed-sarcophagus.html',
    'used': 'ancient subterranean catacombs closed sarcophagus monumental carved stone burial chest with molded plinth footing, relief frieze panels, heavy cornice rim, stepped gabled lid, and corner acroteria finials',
    'limitations': [
        'modular 24-unit wide closed stone sarcophagus fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('closed_sarcophagus', cs, a, regions, plan, area='catacombs')

checker(D, [0, 7.0, 0], [26, 18, 20])
views(D, [0, 7.0, 0], {
    'front': [0, 7.0, 24],
    'three_quarter': [20, 16, 20],
    'back': [-20, 16, -20],
    'gameplay_scale': [28, 22, 28],
    'lid_close': [0, 12.0, 9.0],
    'frieze_close': [0, 5.5, 9.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'closed_sarcophagus.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'closed_sarcophagus_damp.png')
(D/'closed_sarcophagus_dry.png').write_bytes((D/'closed_sarcophagus.png').read_bytes())

call('create_texture', {'name': 'closed_sarcophagus_damp', 'data': str(D/'closed_sarcophagus_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'closed_sarcophagus_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 7.0, 0], {
        'front_damp': [0, 7.0, 24],
        'three_quarter_damp': [20, 16, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('closed_sarcophagus', 'Closed sarcophagus', 'Displaced lid', 'Urn', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['closed_sarcophagus.png', 'closed_sarcophagus_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'lid_close.png', 'frieze_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Closed sarcophagus complete and verified with 100% full coverage!")
