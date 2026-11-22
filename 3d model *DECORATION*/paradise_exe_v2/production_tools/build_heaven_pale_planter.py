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

# Heaven: Pale planter
# Neoclassical carved white quartz marble crater urn planter with molded square plinth footing, fluted pedestal baluster, flared basin with carved relief egg-and-dart rim, rich potting soil, and pale celestial sprouts.

# 1. Plinth footing (Y: 0.0 to 3.0)
c('plinth_base', [-6.0, 0.0, -6.0], [6.0, 1.5, 6.0], 'quartz_marble')
c('plinth_molding', [-5.0, 1.5, -5.0], [5.0, 3.0, 5.0], 'quartz_marble')

# 2. Fluted pedestal stem (Y: 3.0 to 7.0)
c('stem_lower_ring', [-4.0, 3.0, -4.0], [4.0, 4.0, 4.0], 'chiseled_frieze')
c('stem_column', [-3.0, 4.0, -3.0], [3.0, 6.0, 3.0], 'fluted_shaft')
c('stem_upper_capital', [-4.0, 6.0, -4.0], [4.0, 7.0, 4.0], 'chiseled_frieze')

# 3. Planter bowl basin (Y: 7.0 to 12.0)
c('bowl_lower', [-5.5, 7.0, -5.5], [5.5, 8.5, 5.5], 'quartz_marble')
c('bowl_mid', [-7.0, 8.5, -7.0], [7.0, 10.5, 7.0], 'quartz_marble')
c('bowl_base', [-8.0, 10.5, -8.0], [8.0, 12.0, 8.0], 'quartz_marble')

# 4. Basin walls surrounding soil (Y: 12.0 to 13.5)
c('bowl_wall_n', [-8.0, 12.0, 7.0], [8.0, 13.5, 8.0], 'quartz_marble')
c('bowl_wall_s', [-8.0, 12.0, -8.0], [8.0, 13.5, -7.0], 'quartz_marble')
c('bowl_wall_e', [7.0, 12.0, -7.0], [8.0, 13.5, 7.0], 'quartz_marble')
c('bowl_wall_w', [-8.0, 12.0, -7.0], [-7.0, 13.5, 7.0], 'quartz_marble')

# 5. Overhanging molded rim (Y: 13.5 to 14.5)
c('rim_n', [-9.0, 13.5, 7.0], [9.0, 14.5, 9.0], 'chiseled_frieze')
c('rim_s', [-9.0, 13.5, -9.0], [9.0, 14.5, -7.0], 'chiseled_frieze')
c('rim_e', [7.0, 13.5, -7.0], [9.0, 14.5, 7.0], 'chiseled_frieze')
c('rim_w', [-9.0, 13.5, -7.0], [-7.0, 14.5, 7.0], 'chiseled_frieze')

# 6. Soil bed & foliage sprouts (Y: 12.0 to 16.5)
c('soil_bed', [-7.0, 12.0, -7.0], [7.0, 13.0, 7.0], 'rich_soil')
c('sprout_cluster_c', [-2.5, 13.0, -2.5], [2.5, 16.5, 2.5], 'pale_foliage')
c('sprout_cluster_n', [-1.5, 13.0, 3.5], [1.5, 15.5, 6.0], 'pale_foliage')
c('sprout_cluster_s', [-1.5, 13.0, -6.0], [1.5, 15.5, -3.5], 'pale_foliage')
c('sprout_cluster_e', [3.5, 13.0, -1.5], [6.0, 15.5, 1.5], 'pale_foliage')
c('sprout_cluster_w', [-6.0, 13.0, -1.5], [-3.5, 15.5, 1.5], 'pale_foliage')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_shaft': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_frieze': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'rich_soil': (48, 0, 'dirt.png', 16, 16),
    'pale_foliage': (0, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-stone-planter-urn, https://www.alamy.com/stock-photo/antique-marble-garden-urn.html',
    'used': 'heaven sanctuary pale planter neoclassical carved white quartz crater urn planter with molded square plinth footing, fluted pedestal baluster, flared basin with carved relief rim, rich potting soil, and pale celestial sprouts',
    'limitations': [
        'modular 18-unit wide crater urn planter fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, dirt, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('pale_planter', cs, a, regions, plan, area='heaven')

checker(D, [0, 8.0, 0], [22, 22, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 9.0, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'rim_close': [0, 14.0, 10.0],
    'sprouts_close': [0, 15.0, 6.0]
})

# Create disturbed / weathered texture variant
im_weathered = Image.open(D/'pale_planter.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # hairline-cracked calcite marble
im_weathered.paste(Image.open(S/'dirt_with_roots.png').convert('RGBA'), (48, 0)) # desiccated rooty soil
im_weathered.paste(Image.open(S/'deadbush.png').convert('RGBA'), (0, 16)) # withered foliage
im_weathered.save(D/'pale_planter_disturbed.png')
(D/'pale_planter_clean.png').write_bytes((D/'pale_planter.png').read_bytes())

call('create_texture', {'name': 'pale_planter_disturbed', 'data': str(D/'pale_planter_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'pale_planter_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_disturbed': [0, 9.0, 20],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('pale_planter', 'Pale planter', 'Symmetrical flowerbed', 'Clipped hedge', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['pale_planter.png', 'pale_planter_clean.png', 'pale_planter_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'rim_close.png', 'sprouts_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Pale planter complete and verified with 100% full coverage!")
