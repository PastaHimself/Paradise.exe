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

# Catacombs: Straight arch
# Plinth bases (Y: 0.0 to 2.0)
c('plinth_l', [-10.0, 0.0, -3.0], [-6.0, 2.0, 3.0], 'ashlar_stone', off=['down', 'up'])
c('plinth_r', [6.0, 0.0, -3.0], [10.0, 2.0, 3.0], 'ashlar_stone', off=['down', 'up'])

# Pier Shafts (Y: 2.0 to 14.0)
c('shaft_l', [-9.5, 2.0, -2.5], [-6.5, 14.0, 2.5], 'ashlar_stone', off=['down', 'up'])
c('shaft_r', [6.5, 2.0, -2.5], [9.5, 14.0, 2.5], 'ashlar_stone', off=['down', 'up'])

# Impost capitals (Y: 14.0 to 15.0)
c('impost_l', [-10.0, 14.0, -2.8], [-6.0, 15.0, 2.8], 'carved_stone', off=['down', 'up'])
c('impost_r', [6.0, 14.0, -2.8], [10.0, 15.0, 2.8], 'carved_stone', off=['down', 'up'])

# Arch Voussoirs (Y: 15.0 to 22.2)
# Springers
c('springer_l', [-9.0, 15.0, -2.4], [-5.5, 17.5, 2.4], 'cracked_stone', off=['down', 'up'])
c('springer_r', [5.5, 15.0, -2.4], [9.0, 17.5, 2.4], 'cracked_stone', off=['down', 'up'])

# Haunches
c('haunch_l', [-6.5, 17.5, -2.4], [-2.5, 20.0, 2.4], 'ashlar_stone', off=['down', 'up', 'west'])
c('haunch_r', [2.5, 17.5, -2.4], [6.5, 20.0, 2.4], 'ashlar_stone', off=['down', 'up', 'east'])

# Apex / Arch Crown
c('apex_crown', [-3.0, 20.0, -2.4], [3.0, 22.2, 2.4], 'ashlar_stone', off=['down', 'up', 'west', 'east'])

# Keystone bosses (Front and Back ornamental carved keystones)
c('keystone_front', [-1.4, 19.4, 2.4], [1.4, 22.2, 3.2], 'carved_stone', off=['north', 'up'])
c('keystone_back', [-1.4, 19.4, -3.2], [1.4, 22.2, -2.4], 'carved_stone', off=['south', 'up'])

# Spandrels (Masonry above arch haunches and springers, up to entablature Y: 22.2)
c('spandrel_l', [-9.2, 17.5, -2.2], [-6.5, 22.2, 2.2], 'cracked_stone', off=['down', 'up', 'east'])
c('spandrel_r', [6.5, 17.5, -2.2], [9.2, 22.2, 2.2], 'cracked_stone', off=['down', 'up', 'west'])
c('spandrel_mid_l', [-5.5, 20.0, -2.2], [-3.0, 22.2, 2.2], 'ashlar_stone', off=['down', 'up', 'east'])
c('spandrel_mid_r', [3.0, 20.0, -2.2], [5.5, 22.2, 2.2], 'ashlar_stone', off=['down', 'up', 'west'])

# Top Entablature / Cornice Beam (Y: 22.2 to 24.0)
c('cornice', [-10.2, 22.2, -2.6], [10.2, 24.0, 2.6], 'ashlar_stone', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-roman-catacombs-stone-arch, https://www.alamy.com/stock-photo/crypt-vault-archway.html',
    'used': 'ancient subterranean catacombs straight arch modular stone masonry vaulted portal with molded plinths, ashlar shafts, chiseled impost capitals, stepped voussoir arch ring, ornamental carved keystones, spandrel masonry, and cornice entablature',
    'limitations': [
        'modular 20-unit wide straight arch portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, stonebrick_carved pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('straight_arch', cs, a, regions, plan, area='catacombs')

checker(D, [0, 12.0, 0.0], [22, 26, 22])
views(D, [0, 12.0, 0.0], {
    'front': [0, 12.0, 24],
    'three_quarter': [20, 18, 20],
    'back': [-20, 18, -20],
    'gameplay_scale': [28, 24, 28],
    'keystone_close': [0, 20.0, 8.0],
    'impost_close': [-8.0, 14.5, 7.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'straight_arch.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'straight_arch_damp.png')
(D/'straight_arch_dry.png').write_bytes((D/'straight_arch.png').read_bytes())

call('create_texture', {'name': 'straight_arch_damp', 'data': str(D/'straight_arch_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'straight_arch_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.0, 0.0], {
        'front_damp': [0, 12.0, 24],
        'three_quarter_damp': [20, 18, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('straight_arch', 'Straight arch', 'Corner pier', 'Pillar', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['straight_arch.png', 'straight_arch_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'keystone_close.png', 'impost_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Straight arch complete and verified!")
