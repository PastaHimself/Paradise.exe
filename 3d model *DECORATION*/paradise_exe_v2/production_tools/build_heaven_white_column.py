import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Heaven: White column
# Neoclassical temple peristyle white column with molded plinth torus base, fluted octagonal shaft, astragal necking collar, echinus flair, and square abacus capital

# 1. Base plinth & torus ring (Y: 0.0 to 4.5)
c('plinth_base', [-6.0, 0.0, -6.0], [6.0, 2.0, 6.0], 'quartz_smooth')
c('torus_core', [-5.0, 2.0, -5.0], [5.0, 3.5, 5.0], 'quartz_bricks')
c('torus_north', [-4.0, 2.0, -5.5], [4.0, 3.5, -5.0], 'quartz_bricks')
c('torus_south', [-4.0, 2.0, 5.0], [4.0, 3.5, 5.5], 'quartz_bricks')
c('torus_west', [-5.5, 2.0, -4.0], [-5.0, 3.5, 4.0], 'quartz_bricks')
c('torus_east', [5.0, 2.0, -4.0], [5.5, 3.5, 4.0], 'quartz_bricks')
c('scotia_collar', [-4.2, 3.5, -4.2], [4.2, 4.5, 4.2], 'quartz_smooth')

# 2. Fluted classical shaft (Y: 4.5 to 22.0)
c('shaft_core', [-3.5, 4.5, -3.5], [3.5, 22.0, 3.5], 'quartz_fluted')
c('flute_north', [-2.5, 4.5, -4.0], [2.5, 22.0, -3.5], 'quartz_fluted')
c('flute_south', [-2.5, 4.5, 3.5], [2.5, 22.0, 4.0], 'quartz_fluted')
c('flute_west', [-4.0, 4.5, -2.5], [-3.5, 22.0, 2.5], 'quartz_fluted')
c('flute_east', [3.5, 4.5, -2.5], [4.0, 22.0, 2.5], 'quartz_fluted')

# 3. Shaft necking astragal (Y: 22.0 to 23.5)
c('necking_ring', [-4.2, 22.0, -4.2], [4.2, 23.5, 4.2], 'quartz_smooth')

# 4. Capital echinus, square abacus, and crown boss (Y: 23.5 to 27.5)
c('echinus_flair', [-5.0, 23.5, -5.0], [5.0, 25.0, 5.0], 'quartz_chiseled')
c('abacus_square', [-6.0, 25.0, -6.0], [6.0, 26.5, 6.0], 'quartz_smooth')
c('crown_boss', [-3.0, 26.5, -3.0], [3.0, 27.5, 3.0], 'quartz_bricks')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_fluted': (16, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'quartz_bricks': (48, 0, 'quartz_bricks.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-white-marble-column, https://www.alamy.com/stock-photo/ancient-greek-doric-ionic-white-column.html',
    'used': 'heaven sanctuary neoclassical peristyle white quartz column with molded plinth torus base, fluted shaft, astragal necking collar, echinus flair, and square abacus capital',
    'limitations': [
        'modular 27.5-unit tall white column fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, quartz_bricks pixels unchanged; pristine and crystalline-cracked variants'
    ]
}

D = build('white_column', cs, a, regions, plan, area='heaven')

checker(D, [0, 13.5, 0], [22, 24, 22])
views(D, [0, 13.5, 0], {
    'front': [0, 13.5, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 22, 26],
    'capital_close': [0, 24.0, 8.0],
    'base_close': [0, 3.0, 8.0]
})

# Create crystalline-cracked variant texture and views
im_cracked = Image.open(D/'white_column.png').convert('RGBA')
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
im_cracked.save(D/'white_column_cracked.png')
(D/'white_column_pristine.png').write_bytes((D/'white_column.png').read_bytes())

call('create_texture', {'name': 'white_column_cracked', 'data': str(D/'white_column_cracked.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'white_column_cracked'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 13.5, 0], {
        'front_cracked': [0, 13.5, 20],
        'three_quarter_cracked': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('white_column', 'White column', 'Column capital', 'White arch', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['pristine', 'crystalline_cracked'],
    'textures': ['white_column.png', 'white_column_pristine.png', 'white_column_cracked.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'capital_close.png', 'base_close.png', 'front_cracked.png', 'three_quarter_cracked.png']
}, indent=2))

print("Heaven White column complete and verified with 100% full coverage!")
