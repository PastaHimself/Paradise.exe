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

# Heaven: Disturbed safety sign geometry
# Broken monumental classical white marble reassurance plaque with fractured plinth base, split inscribed tablet, severed gilded inscription rules, snapped and toppled right fluted pilaster, fallen pediment crest chunk, and floor marble debris fragments.

# 1. Stepped base plinth (Y: 0.5 to 4.5)
c('plinth_left', [-9.0, 2.0, 5.5], [1.0, 3.2, 7.0], 'quartz_backplate')
c('plinth_fractured_right', [1.0, 1.2, 5.7], [7.0, 2.5, 6.9], 'calcite_fractured')
c('plinth_molding_l', [-8.2, 3.2, 5.7], [0.5, 4.5, 7.0], 'quartz_backplate')
c('lower_apron_l', [-2.5, 0.5, 5.8], [0.0, 2.0, 6.8], 'chiseled_pediment')

# 2. Left framing pilaster (upright with broken top)
c('pilaster_l_main', [-8.2, 4.5, 5.6], [-6.4, 15.0, 6.8], 'quartz_pilasters')
c('pilaster_l_broken_top', [-8.2, 15.0, 5.7], [-6.4, 17.5, 6.7], 'calcite_fractured')
c('pilaster_cap_l_askew', [-8.5, 17.5, 5.4], [-6.1, 18.5, 6.8], 'chiseled_pediment')

# 3. Right pilaster stump & toppled section on floor
c('pilaster_r_stump', [6.4, 2.5, 5.8], [8.2, 7.5, 6.8], 'calcite_fractured')
c('pilaster_r_toppled', [6.5, 0.0, 1.5], [8.5, 1.8, 5.2], 'quartz_pilasters')

# 4. Central inscribed tablet split
c('tablet_field_left', [-6.4, 4.5, 6.0], [-0.5, 17.5, 7.0], 'quartz_backplate')
c('tablet_field_right_drop', [0.5, 3.5, 5.9], [6.4, 15.0, 6.9], 'calcite_fractured')
c('inscription_relief_l', [-5.5, 9.0, 5.8], [-0.5, 13.5, 6.0], 'gilt_inscription')
c('inscription_relief_r', [0.5, 8.0, 5.7], [5.5, 12.5, 5.9], 'gilt_inscription')
c('inscription_upper_rule_l', [-5.0, 14.5, 5.8], [-0.5, 15.0, 6.0], 'gilt_inscription')
c('inscription_lower_rule_l', [-5.0, 7.5, 5.8], [-0.5, 8.0, 6.0], 'gilt_inscription')
c('inscription_lower_rule_r', [0.5, 6.5, 5.7], [5.0, 7.0, 5.9], 'gilt_inscription')

# 5. Fallen pediment crest & debris on floor
c('pediment_fallen_apex', [-3.5, 0.0, 2.5], [2.5, 1.5, 4.5], 'chiseled_pediment')
c('pediment_fallen_cornice', [-7.0, 0.0, 3.0], [-3.8, 1.2, 5.0], 'chiseled_pediment')
c('debris_marble_shard_1', [3.0, 0.0, 1.0], [5.5, 0.8, 2.8], 'calcite_fractured')
c('debris_marble_shard_2', [-2.0, 0.0, 0.5], [0.5, 0.5, 2.0], 'calcite_fractured')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_backplate': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'calcite_fractured': (16, 0, 'calcite.png', 16, 16),
    'quartz_pilasters': (32, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_pediment': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'gilt_inscription': (0, 16, 'gilded_blackstone.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-classical-marble-inscription-tablet, https://www.alamy.com/stock-photo/ruined-marble-sanctuary-stele.html',
    'used': 'heaven sanctuary disturbed safety sign geometry broken monumental classical white marble reassurance plaque with fractured plinth base, split inscribed tablet, severed gilded inscription rules, snapped and toppled right fluted pilaster, fallen pediment crest chunk, and floor marble debris fragments',
    'limitations': [
        'modular 17.5-unit wide disturbed sanctuary safety sign geometry fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, calcite, quartz_block_lines, quartz_block_chiseled, gilded_blackstone pixels unchanged; dry and weathered variants'
    ]
}

D = build('disturbed_safety_sign_geometry', cs, a, regions, plan, area='heaven')

checker(D, [0, 9.0, 4.0], [22, 22, 20])
views(D, [0, 9.0, 4.0], {
    'front': [0, 9.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 18, 26],
    'split_close': [0, 10.0, 10.0],
    'fallen_pediment_close': [0, 2.0, 8.0]
})

# Create weathered texture variant
im_weathered = Image.open(D/'disturbed_safety_sign_geometry.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # weather base quartz to calcite
im_weathered.save(D/'disturbed_safety_sign_geometry_weathered.png')
(D/'disturbed_safety_sign_geometry_standard.png').write_bytes((D/'disturbed_safety_sign_geometry.png').read_bytes())

call('create_texture', {'name': 'disturbed_safety_sign_geometry_weathered', 'data': str(D/'disturbed_safety_sign_geometry_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'disturbed_safety_sign_geometry_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 4.0], {
        'front_weathered': [0, 9.0, 20],
        'three_quarter_weathered': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('disturbed_safety_sign_geometry', 'Disturbed safety sign geometry', 'Pale planter', 'Symmetrical flowerbed', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['standard', 'weathered'],
    'textures': ['disturbed_safety_sign_geometry.png', 'disturbed_safety_sign_geometry_standard.png', 'disturbed_safety_sign_geometry_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'split_close.png', 'fallen_pediment_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Heaven Disturbed safety sign geometry complete and verified with 100% full coverage!")
