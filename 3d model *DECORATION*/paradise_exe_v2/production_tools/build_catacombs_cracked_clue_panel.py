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

# Catacombs: Cracked clue panel
# 1. Base / Plinth (Y: 0.0 to 2.5)
c('base_plinth', [-8.0, 0.0, -2.0], [8.0, 2.5, 2.0], 'ashlar_stone')

# 2. Side pilasters (Y: 2.5 to 17.5)
c('pilaster_l', [-8.0, 2.5, -1.8], [-5.5, 17.5, 1.8], 'ashlar_stone')
c('pilaster_r', [5.5, 2.5, -1.8], [8.0, 17.5, 1.8], 'ashlar_stone')

# 3. Top Cornice (Y: 17.5 to 20.0)
c('architrave', [-8.5, 17.5, -2.2], [8.5, 18.8, 2.2], 'ashlar_stone')
c('cornice', [-9.0, 18.8, -2.5], [9.0, 20.0, 2.5], 'ashlar_stone')

# 4. Inscription Field Backing
c('backing_wall', [-5.5, 2.5, -1.5], [5.5, 17.5, -0.2], 'ashlar_stone')

# 5. Fractured Inscription Relief Slabs (seam at X=0.0, horizontal fracture stepped)
c('slab_lower_l', [-5.5, 2.5, -0.2], [0.0, 9.5, 1.2], 'carved_relief')
c('slab_lower_r', [0.0, 2.5, -0.2], [5.5, 7.5, 1.0], 'carved_relief')
c('slab_upper_l', [-5.5, 9.5, -0.2], [0.0, 17.5, 1.1], 'carved_relief')
c('slab_upper_r', [0.0, 7.5, -0.2], [5.5, 17.5, 1.2], 'carved_relief')

# 6. Fracture debris & displaced wedges
c('fallen_chip', [2.0, 2.5, 1.0], [4.5, 3.8, 2.0], 'cracked_stone')
c('fissure_wedge', [-0.6, 7.5, 1.2], [0.6, 9.5, 1.6], 'cracked_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'carved_relief': (48, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-stone-inscription-catacomb-tablet, https://www.alamy.com/stock-photo/crypt-carved-relief-panel.html',
    'used': 'ancient subterranean catacombs cracked clue panel monumental framed wall relief tablet fractured across its inscription field into offset slabs, featuring dim unlit carved relief in default state and high-contrast illuminated torchlight-readable runes in active variant',
    'limitations': [
        'modular 18-unit wide cracked clue tablet fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, gilded_blackstone pixels unchanged; unlit, torchlight readable, and damp/mossy variants'
    ]
}

D = build('cracked_clue_panel', cs, a, regions, plan, area='catacombs')

checker(D, [0, 10.0, 0], [22, 22, 22])
views(D, [0, 10.0, 0], {
    'front': [0, 10.0, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 22, 26],
    'relief_close': [0, 10.0, 6.0],
    'fissure_close': [0, 8.0, 5.0]
})

# Create torchlight-readable variant texture (gilded_blackstone runes revealed under torchlight)
im_torch = Image.open(D/'cracked_clue_panel.png').convert('RGBA')
im_torch.paste(Image.open(S/'gilded_blackstone.png').convert('RGBA'), (48, 0))
im_torch.save(D/'cracked_clue_panel_torchlight.png')
(D/'cracked_clue_panel_unlit.png').write_bytes((D/'cracked_clue_panel.png').read_bytes())

# Create damp / mossy variant texture
im_mossy = Image.open(D/'cracked_clue_panel.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'cracked_clue_panel_damp.png')

call('create_texture', {'name': 'cracked_clue_panel_torchlight', 'data': str(D/'cracked_clue_panel_torchlight.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'cracked_clue_panel_torchlight'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 0], {
        'front_torchlight': [0, 10.0, 20],
        'three_quarter_torchlight': [18, 16, 18],
        'relief_torchlight': [0, 10.0, 6.0]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('cracked_clue_panel', 'Cracked clue panel', 'Open-passage frame', 'Empty niche', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['unlit', 'torchlight_readable', 'damp_mossy'],
    'textures': ['cracked_clue_panel.png', 'cracked_clue_panel_torchlight.png', 'cracked_clue_panel_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'relief_close.png', 'fissure_close.png', 'front_torchlight.png', 'three_quarter_torchlight.png', 'relief_torchlight.png']
}, indent=2))

print("Catacombs Cracked clue panel complete and verified with torchlight-readable variant and 100% full coverage!")
