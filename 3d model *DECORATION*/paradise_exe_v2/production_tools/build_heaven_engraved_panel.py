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

# Heaven: Engraved panel
# Monumental neoclassical carved white quartz marble wall relief panel with molded supporting sill and corbel brackets, fluted outer frame, egg-and-dart inner border, central allegorical sunburst bas-relief emblem, and upper molded cornice with pediment crest.

# 1. Lower supporting sill & corbels (Y: 0.5 to 3.2)
c('sill_base', [-9.0, 2.0, 5.0], [9.0, 3.2, 7.0], 'quartz_marble')
c('corbel_l', [-7.5, 0.5, 5.2], [-5.5, 2.0, 6.8], 'chiseled_relief')
c('corbel_r', [5.5, 0.5, 5.2], [7.5, 2.0, 6.8], 'chiseled_relief')

# 2. Outer molded frame (Y: 3.2 to 21.0)
c('frame_l', [-9.0, 3.2, 5.5], [-7.0, 21.0, 7.0], 'fluted_trim')
c('frame_r', [7.0, 3.2, 5.5], [9.0, 21.0, 7.0], 'fluted_trim')
c('frame_top', [-7.0, 19.5, 5.5], [7.0, 21.0, 7.0], 'fluted_trim')
c('frame_bottom', [-7.0, 3.2, 5.5], [7.0, 4.5, 7.0], 'fluted_trim')

# 3. Recessed central bas-relief field & relief panels (Y: 4.5 to 19.5)
c('panel_backing', [-7.0, 4.5, 6.0], [7.0, 19.5, 7.0], 'quartz_marble')
c('inner_border_l', [-6.5, 5.0, 5.8], [-5.5, 19.0, 6.0], 'chiseled_relief')
c('inner_border_r', [5.5, 5.0, 5.8], [6.5, 19.0, 6.0], 'chiseled_relief')
c('inner_border_top', [-5.5, 18.0, 5.8], [5.5, 19.0, 6.0], 'chiseled_relief')
c('inner_border_bottom', [-5.5, 5.0, 5.8], [5.5, 6.0, 6.0], 'chiseled_relief')
c('central_relief_emblem', [-3.5, 9.5, 5.7], [3.5, 14.5, 6.0], 'chiseled_relief')
c('upper_motif', [-2.5, 15.5, 5.7], [2.5, 17.5, 6.0], 'chiseled_relief')
c('lower_motif', [-2.5, 6.5, 5.7], [2.5, 8.5, 6.0], 'chiseled_relief')

# 4. Upper cornice & pediment crest (Y: 21.0 to 26.0)
c('cornice_ledge', [-9.5, 21.0, 5.0], [9.5, 22.5, 7.0], 'quartz_marble')
c('pediment_crest', [-6.0, 22.5, 5.4], [6.0, 24.5, 6.8], 'chiseled_relief')
c('crest_finial', [-1.5, 24.5, 5.2], [1.5, 26.0, 6.6], 'chiseled_relief')

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
    'reference': 'https://www.shutterstock.com/search/classical-marble-relief-panel, https://www.alamy.com/stock-photo/ancient-roman-carved-marble-frieze.html',
    'used': 'heaven sanctuary engraved panel monumental neoclassical carved white quartz marble wall relief panel with molded supporting sill and corbel brackets, fluted outer frame, egg-and-dart inner border, central allegorical sunburst bas-relief emblem, and upper molded cornice with pediment crest',
    'limitations': [
        'modular 19-unit wide carved wall relief panel fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('engraved_panel', cs, a, regions, plan, area='heaven')

checker(D, [0, 13.0, 6.0], [22, 26, 20])
views(D, [0, 13.0, 6.0], {
    'front': [0, 13.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'emblem_close': [0, 12.0, 10.0],
    'crest_close': [0, 23.0, 10.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'engraved_panel.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble frame
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weathered bas-relief
im_disturbed.save(D/'engraved_panel_disturbed.png')
(D/'engraved_panel_clean.png').write_bytes((D/'engraved_panel.png').read_bytes())

call('create_texture', {'name': 'engraved_panel_disturbed', 'data': str(D/'engraved_panel_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'engraved_panel_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 13.0, 6.0], {
        'front_disturbed': [0, 13.0, 22],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('engraved_panel', 'Engraved panel', 'Blank plaque', 'Hanging fabric', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['engraved_panel.png', 'engraved_panel_clean.png', 'engraved_panel_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'emblem_close.png', 'crest_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Engraved panel complete and verified with 100% full coverage!")
