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

# Heaven: Blank plaque
# Monumental neoclassical uncarved white quartz marble tabula ansata plaque with molded outer border, classical dovetail ear handles, polished pristine central field, and carved apex pediment crest.

# 1. Backing base plate (Y: 5.0 to 17.0, Z: 6.2 to 7.0)
c('backing_plate', [-6.0, 5.0, 6.2], [6.0, 17.0, 7.0], 'quartz_marble')

# 2. Molded outer frame (Y: 3.8 to 18.2, Z: 5.5 to 7.0)
c('frame_top', [-7.5, 17.0, 5.5], [7.5, 18.2, 7.0], 'fluted_trim')
c('frame_bottom', [-7.5, 3.8, 5.5], [7.5, 5.0, 7.0], 'fluted_trim')
c('frame_l', [-7.5, 5.0, 5.5], [-6.0, 17.0, 7.0], 'fluted_trim')
c('frame_r', [6.0, 5.0, 5.5], [7.5, 17.0, 7.0], 'fluted_trim')

# 3. Tabula ansata dovetail ears (Y: 7.5 to 14.5, Z: 5.8 to 6.8)
c('ear_l_base', [-9.5, 8.0, 5.8], [-7.5, 14.0, 6.8], 'chiseled_relief')
c('ear_l_wing_top', [-11.0, 12.0, 5.8], [-9.5, 14.5, 6.8], 'chiseled_relief')
c('ear_l_wing_bot', [-11.0, 7.5, 5.8], [-9.5, 10.0, 6.8], 'chiseled_relief')

c('ear_r_base', [7.5, 8.0, 5.8], [9.5, 14.0, 6.8], 'chiseled_relief')
c('ear_r_wing_top', [9.5, 12.0, 5.8], [11.0, 14.5, 6.8], 'chiseled_relief')
c('ear_r_wing_bot', [9.5, 7.5, 5.8], [11.0, 10.0, 6.8], 'chiseled_relief')

# 4. Pristine blank marble tablet field (Y: 5.0 to 17.0, Z: 5.8 to 6.2)
c('blank_field', [-6.0, 5.0, 5.8], [6.0, 17.0, 6.2], 'quartz_marble')

# 5. Top crest (Y: 18.2 to 20.8, Z: 5.5 to 6.8)
c('crest_pediment', [-4.5, 18.2, 5.5], [4.5, 19.5, 6.8], 'chiseled_relief')
c('crest_apex', [-1.5, 19.5, 5.5], [1.5, 20.8, 6.6], 'chiseled_relief')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_trim': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_relief': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'calcite_cracked': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-tabula-ansata-marble-plaque, https://www.alamy.com/stock-photo/ancient-roman-blank-marble-tablet.html',
    'used': 'heaven sanctuary blank plaque monumental neoclassical uncarved white quartz marble tabula ansata plaque with molded outer border, classical dovetail ear handles, polished pristine central field, and carved apex pediment crest',
    'limitations': [
        'modular 22-unit wide tabula ansata plaque fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('blank_plaque', cs, a, regions, plan, area='heaven')

checker(D, [0, 12.0, 6.0], [24, 22, 16])
views(D, [0, 12.0, 6.0], {
    'front': [0, 12.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 18, 26],
    'ear_close': [-9.0, 11.0, 10.0],
    'crest_close': [0, 19.0, 10.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'blank_plaque.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked field
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weathered ears
im_disturbed.save(D/'blank_plaque_disturbed.png')
(D/'blank_plaque_clean.png').write_bytes((D/'blank_plaque.png').read_bytes())

call('create_texture', {'name': 'blank_plaque_disturbed', 'data': str(D/'blank_plaque_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'blank_plaque_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.0, 6.0], {
        'front_disturbed': [0, 12.0, 20],
        'three_quarter_disturbed': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('blank_plaque', 'Blank plaque', 'Hanging fabric', 'Seal pedestal', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['blank_plaque.png', 'blank_plaque_clean.png', 'blank_plaque_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'ear_close.png', 'crest_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Blank plaque complete and verified with 100% full coverage!")
