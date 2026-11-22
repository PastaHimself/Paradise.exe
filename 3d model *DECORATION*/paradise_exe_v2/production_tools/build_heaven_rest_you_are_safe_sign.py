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

# Heaven: REST / YOU ARE SAFE sign
# Neoclassical carved white marble sanctuary reassurance plaque with molded stepped plinth, fluted framing pilasters, classical triangular pediment with relief acanthus crest, engraved central tablet with gilded incised relief, and lower molded apron.

# 1. Base plinth & lower molded apron (Y: 0.5 to 4.5)
c('plinth_base', [-9.0, 2.0, 5.5], [9.0, 3.2, 7.0], 'quartz_backplate')
c('plinth_molding', [-8.2, 3.2, 5.7], [8.2, 4.5, 7.0], 'quartz_backplate')
c('lower_apron_drop', [-2.5, 0.5, 5.8], [2.5, 2.0, 6.8], 'chiseled_pediment')

# 2. Framing side pilasters (Y: 4.5 to 18.5)
c('pilaster_l', [-8.2, 4.5, 5.6], [-6.4, 17.5, 6.8], 'quartz_pilasters')
c('pilaster_r', [6.4, 4.5, 5.6], [8.2, 17.5, 6.8], 'quartz_pilasters')
c('pilaster_cap_l', [-8.5, 17.5, 5.4], [-6.1, 18.5, 6.9], 'chiseled_pediment')
c('pilaster_cap_r', [6.1, 17.5, 5.4], [8.5, 18.5, 6.9], 'chiseled_pediment')

# 3. Central inscribed tablet (Y: 4.5 to 17.5)
c('tablet_field', [-6.4, 4.5, 6.0], [6.4, 17.5, 7.0], 'quartz_backplate')
c('inscription_relief', [-5.5, 9.0, 5.8], [5.5, 13.5, 6.0], 'gilt_inscription')
c('inscription_upper_rule', [-5.0, 14.5, 5.8], [5.0, 15.0, 6.0], 'gilt_inscription')
c('inscription_lower_rule', [-5.0, 7.5, 5.8], [5.0, 8.0, 6.0], 'gilt_inscription')

# 4. Classical architrave & triangular pediment crest (Y: 18.5 to 26.0)
c('architrave_frieze', [-8.5, 18.5, 5.6], [8.5, 20.0, 6.8], 'chiseled_pediment')
c('cornice_ledge', [-9.2, 20.0, 5.3], [9.2, 21.2, 7.0], 'quartz_backplate')
c('pediment_base', [-8.0, 21.2, 5.6], [8.0, 22.4, 6.8], 'chiseled_pediment')
c('pediment_mid', [-5.5, 22.4, 5.6], [5.5, 23.5, 6.8], 'chiseled_pediment')
c('pediment_apex', [-2.5, 23.5, 5.6], [2.5, 24.5, 6.8], 'chiseled_pediment')
c('pediment_crest_finial', [-1.0, 24.5, 5.4], [1.0, 26.0, 6.6], 'chiseled_pediment')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_backplate': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_pilasters': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_pediment': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'gilt_inscription': (48, 0, 'gilded_blackstone.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-marble-inscription-plaque, https://www.alamy.com/stock-photo/roman-marble-sanctuary-tablet.html',
    'used': 'heaven sanctuary rest you are safe sign classical monumental carved white quartz reassurance plaque with molded plinth, fluted framing pilasters, acanthus pediment crest, and gilded incised inscription tablet',
    'limitations': [
        'modular 18.4-unit wide sanctuary reassurance plaque fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, gilded_blackstone pixels unchanged; clean and disturbed texture variants'
    ]
}

D = build('rest_you_are_safe_sign', cs, a, regions, plan, area='heaven')

checker(D, [0, 13.0, 6.0], [22, 26, 20])
views(D, [0, 13.0, 6.0], {
    'front': [0, 13.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'inscription_close': [0, 11.5, 10.0],
    'pediment_close': [0, 22.0, 10.0]
})

# Create disturbed texture variant (cracked calcite marble & weathered gilt)
im_disturbed = Image.open(D/'rest_you_are_safe_sign.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # weather base quartz to calcite
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weather chiseled pediment
im_disturbed.save(D/'rest_you_are_safe_sign_disturbed.png')
(D/'rest_you_are_safe_sign_clean.png').write_bytes((D/'rest_you_are_safe_sign.png').read_bytes())

call('create_texture', {'name': 'rest_you_are_safe_sign_disturbed', 'data': str(D/'rest_you_are_safe_sign_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'rest_you_are_safe_sign_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 13.0, 6.0], {
        'front_disturbed': [0, 13.0, 22],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('rest_you_are_safe_sign', 'REST / YOU ARE SAFE sign', 'Disturbed safety sign geometry', 'Pale planter', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['rest_you_are_safe_sign.png', 'rest_you_are_safe_sign_clean.png', 'rest_you_are_safe_sign_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'inscription_close.png', 'pediment_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven REST / YOU ARE SAFE sign complete and verified with 100% full coverage!")
