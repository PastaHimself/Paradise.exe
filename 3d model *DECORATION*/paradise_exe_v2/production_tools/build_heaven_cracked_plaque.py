import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions, audit_full_coverage

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Heaven: Cracked plaque
# Fractured monumental neoclassical tabula ansata marble wall plaque with cracked border molding, fractured dovetail ears, fissure-split tablet field fragments, and fallen marble shard.

# 1. Backing base plate (Y: 5.0 to 17.0, Z: 6.3 to 7.0)
c('backing_plate', [-6.0, 5.0, 6.3], [6.0, 17.0, 7.0], 'quartz_marble')

# 2. Fractured frame
c('frame_top_l', [-7.5, 17.0, 5.5], [-0.5, 18.2, 7.0], 'fluted_trim')
c('frame_top_r', [-0.2, 17.0, 5.5], [7.5, 18.2, 7.0], 'fluted_trim')
c('frame_bottom_l', [-7.5, 3.8, 5.5], [1.0, 5.0, 7.0], 'fluted_trim')
c('frame_bottom_r', [1.3, 3.8, 5.5], [7.5, 5.0, 7.0], 'fluted_trim')
c('frame_l', [-7.5, 5.0, 5.5], [-6.0, 17.0, 7.0], 'fluted_trim')
c('frame_r', [6.0, 5.0, 5.5], [7.5, 17.0, 7.0], 'fluted_trim')

# 3. Tabula ansata ears
c('ear_l_base', [-9.5, 8.0, 5.8], [-7.5, 14.0, 6.8], 'chiseled_relief')
c('ear_l_wing_top', [-11.0, 12.0, 5.8], [-9.5, 14.5, 6.8], 'chiseled_relief')
c('ear_l_wing_bot', [-11.0, 7.5, 5.8], [-9.5, 10.0, 6.8], 'chiseled_relief')

c('ear_r_base', [7.5, 8.0, 5.8], [9.5, 12.0, 6.8], 'chiseled_relief')
c('ear_r_wing_bot', [9.5, 7.5, 5.8], [10.5, 9.5, 6.8], 'chiseled_relief')

# 4. Fractured tablet field fragments (Z: 5.7 to 6.3)
c('field_fragment_lower_l', [-6.0, 5.0, 5.8], [0.5, 10.5, 6.2], 'quartz_marble')
c('field_fragment_lower_r', [0.8, 5.0, 5.9], [6.0, 10.5, 6.3], 'calcite_cracked')
c('field_fragment_upper_l', [-6.0, 10.7, 5.9], [-1.0, 17.0, 6.3], 'calcite_cracked')
c('field_fragment_upper_r', [-0.7, 10.7, 5.7], [6.0, 17.0, 6.1], 'quartz_marble')

# 5. Top crest
c('crest_pediment', [-4.5, 18.2, 5.5], [4.5, 19.5, 6.8], 'chiseled_relief')
c('crest_apex', [-1.5, 19.5, 5.5], [1.5, 20.8, 6.6], 'chiseled_relief')

# 6. Displaced fallen shard
c('fallen_shard', [-2.5, 2.8, 4.5], [1.5, 3.8, 6.0], 'calcite_cracked')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_trim': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_relief': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'calcite_cracked': (48, 0, 'calcite.png', 16, 16),
    'weathered_crust': (0, 16, 'stonebrick_cracked.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-roman-marble-inscription-slab, https://www.alamy.com/stock-photo/cracked-classical-wall-plaque.html',
    'used': 'heaven sanctuary cracked plaque fractured monumental neoclassical tabula ansata marble wall plaque with cracked border molding, fractured dovetail ears, fissure-split tablet field fragments, and fallen marble shard',
    'limitations': [
        'modular 22-unit wide cracked tabula ansata plaque fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, calcite, stonebrick_cracked pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('cracked_plaque', cs, a, regions, plan, area='heaven')

checker(D, [0, 12.0, 6.0], [24, 22, 16])
views(D, [0, 12.0, 6.0], {
    'front': [0, 12.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 18, 26],
    'fissure_close': [0, 11.0, 10.0],
    'fallen_shard_close': [0, 3.5, 10.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'cracked_plaque.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'stonebrick_cracked.png').convert('RGBA'), (0, 0)) # cracked marble base
im_disturbed.paste(Image.open(S/'stonebrick_cracked.png').convert('RGBA'), (32, 0)) # weathered chiseled crest
im_disturbed.paste(Image.open(S/'stonebrick_cracked.png').convert('RGBA'), (48, 0)) # heavy fissures on field
im_disturbed.save(D/'cracked_plaque_disturbed.png')
(D/'cracked_plaque_clean.png').write_bytes((D/'cracked_plaque.png').read_bytes())

call('create_texture', {'name': 'cracked_plaque_disturbed', 'data': str(D/'cracked_plaque_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'cracked_plaque_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.0, 6.0], {
        'front_disturbed': [0, 12.0, 20],
        'three_quarter_disturbed': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('cracked_plaque', 'Cracked plaque', 'Finale discoloration', 'Shared assets', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['cracked_plaque.png', 'cracked_plaque_clean.png', 'cracked_plaque_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'fissure_close.png', 'fallen_shard_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Cracked plaque complete and verified with 100% full coverage!")
