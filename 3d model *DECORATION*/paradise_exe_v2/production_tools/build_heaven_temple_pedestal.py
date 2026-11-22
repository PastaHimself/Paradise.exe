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

# Heaven: Temple pedestal
# Monumental neoclassical carved white quartz marble sanctuary monument plinth with stepped base footing, fluted dado shaft with corner pilasters, carved relief acanthus side panels, classical molded echinus capital, and polished abacus display tablet.

# 1. Stepped base plinth (Y: 0.0 to 5.0)
c('plinth_step1', [-8.0, 0.0, -8.0], [8.0, 2.0, 8.0], 'quartz_marble')
c('plinth_step2', [-7.0, 2.0, -7.0], [7.0, 3.5, 7.0], 'quartz_marble')
c('plinth_torus', [-6.2, 3.5, -6.2], [6.2, 5.0, 6.2], 'chiseled_relief')

# 2. Pedestal dado shaft (Y: 5.0 to 16.0)
c('shaft_core', [-4.2, 5.0, -4.2], [4.2, 16.0, 4.2], 'fluted_shaft')

c('pilaster_nw', [-5.8, 5.0, 4.2], [-4.2, 16.0, 5.8], 'fluted_shaft')
c('pilaster_ne', [4.2, 5.0, 4.2], [5.8, 16.0, 5.8], 'fluted_shaft')
c('pilaster_sw', [-5.8, 5.0, -5.8], [-4.2, 16.0, -4.2], 'fluted_shaft')
c('pilaster_se', [4.2, 5.0, -5.8], [5.8, 16.0, -4.2], 'fluted_shaft')

c('wall_n', [-4.2, 5.0, 4.2], [4.2, 16.0, 5.2], 'chiseled_relief')
c('wall_s', [-4.2, 5.0, -5.2], [4.2, 16.0, -4.2], 'chiseled_relief')
c('wall_w', [-5.2, 5.0, -4.2], [-4.2, 16.0, 4.2], 'chiseled_relief')
c('wall_e', [4.2, 5.0, -4.2], [5.2, 16.0, 4.2], 'chiseled_relief')

# 3. Capital & upper molded cornice (Y: 16.0 to 22.0)
c('necking_astragal', [-5.5, 16.0, -5.5], [5.5, 17.2, 5.5], 'chiseled_relief')
c('echinus_capital', [-6.5, 17.2, -6.5], [6.5, 19.0, 6.5], 'chiseled_relief')
c('cornice_molding', [-7.5, 19.0, -7.5], [7.5, 20.8, 7.5], 'quartz_marble')
c('abacus_tablet', [-8.0, 20.8, -8.0], [8.0, 22.0, 8.0], 'quartz_marble')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_shaft': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_relief': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'calcite_cracked': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-marble-temple-pedestal, https://www.alamy.com/stock-photo/ancient-roman-marble-monument-pedestal.html',
    'used': 'heaven sanctuary temple pedestal monumental neoclassical carved white quartz marble sanctuary monument plinth with stepped base footing, fluted dado shaft with corner pilasters, carved relief acanthus side panels, classical molded echinus capital, and polished abacus display tablet',
    'limitations': [
        'modular 16-unit wide monument pedestal plinth fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('temple_pedestal', cs, a, regions, plan, area='heaven')

checker(D, [0, 11.0, 0], [22, 26, 22])
views(D, [0, 11.0, 0], {
    'front': [0, 11.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'capital_close': [0, 19.0, 10.0],
    'plinth_close': [0, 3.0, 10.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'temple_pedestal.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble base and abacus
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weathered carved relief
im_disturbed.save(D/'temple_pedestal_disturbed.png')
(D/'temple_pedestal_clean.png').write_bytes((D/'temple_pedestal.png').read_bytes())

call('create_texture', {'name': 'temple_pedestal_disturbed', 'data': str(D/'temple_pedestal_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'temple_pedestal_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 11.0, 0], {
        'front_disturbed': [0, 11.0, 22],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('temple_pedestal', 'Temple pedestal', 'Altar steps', 'Engraved panel', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['temple_pedestal.png', 'temple_pedestal_clean.png', 'temple_pedestal_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'capital_close.png', 'plinth_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Temple pedestal complete and verified with 100% full coverage!")
