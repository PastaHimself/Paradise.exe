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

# Heaven: Open exit frame
# Monumental neoclassical sanctuary exit portal doorway with swung-open stone seal door leaf, wall hinge brackets, 100% full coverage, clean & disturbed variants.

# 1. Threshold sill & plinths (Y: 0.0 to 3.0)
c('threshold_sill', [-6.0, 0.0, -2.0], [6.0, 2.0, 2.0], 'quartz_marble')
c('jamb_plinth_l', [-11.0, 0.0, -2.5], [-6.0, 3.0, 2.5], 'quartz_marble')
c('jamb_plinth_r', [6.0, 0.0, -2.5], [11.0, 3.0, 2.5], 'quartz_marble')

# 2. Portal pilasters & jamb walls (Y: 3.0 to 20.0)
c('pilaster_l', [-10.5, 3.0, -2.0], [-6.5, 20.0, 2.0], 'fluted_shaft')
c('inner_jamb_l', [-6.5, 3.0, -1.8], [-6.0, 20.0, 1.8], 'quartz_marble')
c('outer_wall_l', [-11.0, 3.0, -1.5], [-10.5, 20.0, 1.5], 'quartz_marble')

c('pilaster_r', [6.5, 3.0, -2.0], [10.5, 20.0, 2.0], 'fluted_shaft')
c('inner_jamb_r', [6.0, 3.0, -1.8], [6.5, 20.0, 1.8], 'quartz_marble')
c('outer_wall_r', [10.5, 3.0, -1.5], [11.0, 20.0, 1.5], 'quartz_marble')

# 3. Capital, architrave, frieze & cornice (Y: 20.0 to 26.5)
c('capital_l', [-11.0, 20.0, -2.5], [-6.0, 21.2, 2.5], 'chiseled_frieze')
c('capital_r', [6.0, 20.0, -2.5], [11.0, 21.2, 2.5], 'chiseled_frieze')
c('architrave_beam', [-6.0, 20.0, -2.0], [6.0, 21.2, 2.0], 'quartz_marble')

c('keystone', [-2.5, 21.2, -2.6], [2.5, 23.5, 2.6], 'chiseled_frieze')
c('frieze_l', [-11.0, 21.2, -2.2], [-2.5, 23.5, 2.2], 'chiseled_frieze')
c('frieze_r', [2.5, 21.2, -2.2], [11.0, 23.5, 2.2], 'chiseled_frieze')

c('cornice_ledge', [-12.0, 23.5, -2.8], [12.0, 25.0, 2.8], 'quartz_marble')
c('pediment_crest', [-7.0, 25.0, -2.0], [7.0, 26.5, 2.0], 'chiseled_frieze')

# 4. Swung-open stone door leaf (hinged on left jamb, swung open into Z: 2.0 to 11.5)
# Door leaf stiles and rails (thickness X: -5.8 to -4.8)
c('door_hinge_stile', [-5.8, 2.2, 2.0], [-4.8, 19.8, 3.2], 'quartz_marble')
c('door_outer_stile', [-5.8, 2.2, 10.3], [-4.8, 19.8, 11.5], 'quartz_marble')
c('door_bottom_rail', [-5.8, 2.2, 3.2], [-4.8, 3.4, 10.3], 'quartz_marble')
c('door_top_rail', [-5.8, 18.6, 3.2], [-4.8, 19.8, 10.3], 'quartz_marble')
c('door_mid_rail', [-5.8, 10.4, 3.2], [-4.8, 11.6, 10.3], 'quartz_marble')

# Door leaf ashlar panels (recessed X: -5.6 to -5.0)
c('door_panel_lower', [-5.6, 3.4, 3.2], [-5.0, 10.4, 10.3], 'quartz_bricks')
c('door_panel_upper', [-5.6, 11.6, 3.2], [-5.0, 18.6, 10.3], 'quartz_bricks')

# 5. Gilt brass hinge straps & mounting pivots
# Bottom hinge strap on door leaf (mounted on X: -4.8 to -4.5, Z: 2.0 to 4.5)
c('hinge_strap_bottom', [-4.8, 4.0, 2.0], [-4.5, 5.0, 4.5], 'gilded_brass')
# Top hinge strap on door leaf (mounted on X: -4.8 to -4.5, Z: 2.0 to 4.5)
c('hinge_strap_top', [-4.8, 17.0, 2.0], [-4.5, 18.0, 4.5], 'gilded_brass')

# Wall hinge pintle brackets on inner jamb (X: -6.0 to -5.7, mounted on face of jamb at Z: 1.0 to 2.0)
c('wall_pintle_bottom', [-6.0, 3.8, 1.0], [-5.7, 5.2, 2.0], 'gilded_brass')
c('wall_pintle_top', [-6.0, 16.8, 1.0], [-5.7, 18.2, 2.0], 'gilded_brass')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 32, 16),
    'fluted_shaft': (32, 0, 'quartz_block_lines.png', 16, 32),
    'chiseled_frieze': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'quartz_bricks': (48, 16, 'quartz_bricks.png', 16, 16),
    'gilded_brass': (32, 32, 'gilded_blackstone.png', 16, 16),
    'calcite_cracked': (0, 32, 'calcite.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-marble-portal-door-frame, https://www.alamy.com/stock-photo/ancient-temple-marble-portal-architrave.html',
    'used': 'heaven sanctuary open exit frame monumental neoclassical sanctuary exit portal doorway architrave with stepped threshold sill, molded jamb plinths, towering fluted pilasters, carved acanthus capital blocks, horizontal architrave beam, relief frieze with projecting keystone, projecting molded cornice ledge, arched pediment crest, and heavy swung-open stone seal door leaf mounted on gilt brass wall pintles',
    'limitations': [
        'modular 24-unit wide portal doorway frame with swung-open seal leaf fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, quartz_bricks, gilded_blackstone, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('open_exit_frame', cs, a, regions, plan, area='heaven')

checker(D, [0, 13.0, 4.0], [26, 28, 20])
views(D, [0, 13.0, 4.0], {
    'front': [0, 13.0, 24],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [28, 22, 28],
    'door_leaf_close': [-5.0, 11.0, 6.0],
    'hinge_close': [-5.0, 17.0, 3.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'open_exit_frame.png').convert('RGBA')
for xx in (0, 16):
    im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (xx, 0)) # cracked cornice/plinth
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (48, 0)) # weathered keystone
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (48, 16)) # cracked door panel
im_disturbed.save(D/'open_exit_frame_disturbed.png')
(D/'open_exit_frame_clean.png').write_bytes((D/'open_exit_frame.png').read_bytes())

call('create_texture', {'name': 'open_exit_frame_disturbed', 'data': str(D/'open_exit_frame_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'open_exit_frame_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 13.0, 4.0], {
        'front_disturbed': [0, 13.0, 24],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('open_exit_frame', 'Open exit frame', 'Escape symbol', 'Seal symbol', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['open_exit_frame.png', 'open_exit_frame_clean.png', 'open_exit_frame_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'door_leaf_close.png', 'hinge_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Open exit frame complete and verified with 100% full coverage!")
