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

# Catacombs: Blocked arch with loose stones
# 1. Arch frame (Y: 0.0 to 16.0)
c('jamb_l', [-9.0, 0.0, -3.0], [-5.0, 9.0, 3.0], 'ashlar_stone')
c('jamb_r', [5.0, 0.0, -3.0], [9.0, 9.0, 3.0], 'ashlar_stone')
c('impost_l', [-9.5, 9.0, -3.2], [-4.5, 10.0, 3.2], 'carved_stone')
c('impost_r', [4.5, 9.0, -3.2], [9.5, 10.0, 3.2], 'carved_stone')
c('springer_l', [-6.5, 10.0, -2.8], [-3.5, 12.0, 2.8], 'cracked_stone')
c('springer_r', [3.5, 10.0, -2.8], [6.5, 12.0, 2.8], 'cracked_stone')
c('arch_crown', [-3.5, 12.0, -2.8], [3.5, 14.5, 2.8], 'ashlar_stone')
c('keystone_front', [-1.4, 11.5, 2.8], [1.4, 14.5, 3.4], 'carved_stone')
c('keystone_back', [-1.4, 11.5, -3.4], [1.4, 14.5, -2.8], 'carved_stone')
c('spandrel_l', [-9.0, 10.0, -2.5], [-6.5, 14.5, 2.5], 'cracked_stone')
c('spandrel_r', [6.5, 10.0, -2.5], [9.0, 14.5, 2.5], 'cracked_stone')
c('spandrel_mid_l', [-6.5, 12.0, -2.5], [-3.5, 14.5, 2.5], 'ashlar_stone')
c('spandrel_mid_r', [3.5, 12.0, -2.5], [6.5, 14.5, 2.5], 'ashlar_stone')
c('cornice', [-9.5, 14.5, -3.0], [9.5, 16.0, 3.0], 'ashlar_stone')

# 2. Infill Blocking Wall
c('block_lower_l', [-5.0, 0.0, -1.8], [0.0, 4.5, 1.8], 'cracked_stone')
c('block_lower_r', [0.0, 0.0, -1.8], [5.0, 4.5, 1.8], 'rough_rubble')
c('block_mid_l', [-5.0, 4.5, -1.6], [-0.8, 8.5, 1.6], 'rough_rubble')
c('block_mid_r', [-0.8, 4.5, -1.6], [5.0, 8.5, 1.6], 'ashlar_stone')
c('block_upper', [-3.5, 8.5, -1.5], [3.5, 12.0, 1.5], 'rough_rubble')

# 3. Spilled floor stones
c('spilled_block_1', [-3.0, 0.0, 2.0], [1.0, 1.8, 4.2], 'cracked_stone')
c('spilled_block_2', [1.5, 0.0, 2.0], [4.8, 1.4, 3.8], 'cracked_stone')
c('rubble_chip', [-4.5, 0.0, 3.2], [-3.2, 0.8, 4.4], 'rough_rubble')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'rough_rubble': (48, 0, 'cobblestone.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/walled-up-catacomb-arch-rubble, https://www.alamy.com/stock-photo/blocked-stone-doorway-crypt.html',
    'used': 'ancient subterranean catacombs blocked arch with loose stones featuring low vaulted stone portal hastily and roughly sealed with dry-stacked rubble stones, displaced ashlar blocks, and fallen scree debris on the floor',
    'limitations': [
        'modular 19-unit wide blocked arch portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, cobblestone pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('blocked_arch_with_loose_stones', cs, a, regions, plan, area='catacombs')

checker(D, [0, 8.0, 0], [22, 18, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 8.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 20, 26],
    'rubble_close': [0, 6.0, 8.0],
    'spilled_close': [0, 2.0, 8.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'blocked_arch_with_loose_stones.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.paste(Image.open(S/'cobblestone_mossy.png').convert('RGBA'), (48, 0))
im_mossy.save(D/'blocked_arch_with_loose_stones_damp.png')
(D/'blocked_arch_with_loose_stones_dry.png').write_bytes((D/'blocked_arch_with_loose_stones.png').read_bytes())

call('create_texture', {'name': 'blocked_arch_with_loose_stones_damp', 'data': str(D/'blocked_arch_with_loose_stones_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'blocked_arch_with_loose_stones_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_damp': [0, 8.0, 20],
        'three_quarter_damp': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('blocked_arch_with_loose_stones', 'Blocked arch with loose stones', 'Sealed stone doorway', 'Cracked clue panel', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['blocked_arch_with_loose_stones.png', 'blocked_arch_with_loose_stones_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'rubble_close.png', 'spilled_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Blocked arch with loose stones complete and verified with 100% full coverage!")
