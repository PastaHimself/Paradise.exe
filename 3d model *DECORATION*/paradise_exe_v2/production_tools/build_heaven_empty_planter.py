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

# Heaven: Empty planter
# Neoclassical carved white quartz marble crater urn planter with molded square plinth footing, fluted pedestal baluster, flared basin with carved relief egg-and-dart rim, recessed dry soil cavity, carved drain rosette, and flanking acanthus handles.

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

# 6. Recessed empty soil cavity & drain rosette
c('empty_soil_bed', [-7.0, 12.0, -7.0], [7.0, 12.6, 7.0], 'desiccated_soil')
c('drain_rosette', [-2.0, 12.6, -2.0], [2.0, 12.9, 2.0], 'chiseled_frieze')

# 7. Flanking carved handles
c('handle_l', [-9.8, 11.5, -1.5], [-8.0, 13.5, 1.5], 'fluted_shaft')
c('handle_r', [8.0, 11.5, -1.5], [9.8, 13.5, 1.5], 'fluted_shaft')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_shaft': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_frieze': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'desiccated_soil': (48, 0, 'dirt_with_roots.png', 16, 16),
    'calcite_cracked': (0, 32, 'calcite.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-stone-planter-urn, https://www.alamy.com/stock-photo/antique-marble-garden-urn.html',
    'used': 'heaven sanctuary empty planter neoclassical carved white quartz crater urn planter with molded square plinth footing, fluted pedestal baluster, flared basin with carved relief egg-and-dart rim, recessed dry soil cavity, carved drain rosette, and flanking acanthus handles',
    'limitations': [
        'modular 20-unit wide crater urn planter fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, dirt_with_roots, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('empty_planter', cs, a, regions, plan, area='heaven')

checker(D, [0, 8.0, 0], [22, 22, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 9.0, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'rim_close': [0, 14.0, 10.0],
    'basin_close': [0, 15.0, 6.0]
})

# Create disturbed / weathered texture variant
im_weathered = Image.open(D/'empty_planter.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble plinth/walls
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weathered frieze
im_weathered.paste(Image.open(S/'deadbush.png').convert('RGBA'), (48, 0)) # parched soil crust
im_weathered.save(D/'empty_planter_disturbed.png')
(D/'empty_planter_clean.png').write_bytes((D/'empty_planter.png').read_bytes())

call('create_texture', {'name': 'empty_planter_disturbed', 'data': str(D/'empty_planter_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'empty_planter_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_disturbed': [0, 9.0, 20],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('empty_planter', 'Empty planter', 'Cracked plaque', 'Finale discoloration', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['empty_planter.png', 'empty_planter_clean.png', 'empty_planter_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'rim_close.png', 'basin_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Empty planter complete and verified with 100% full coverage!")
