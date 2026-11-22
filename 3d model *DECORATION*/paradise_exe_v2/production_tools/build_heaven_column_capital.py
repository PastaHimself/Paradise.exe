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

# Heaven: Column capital
# Neoclassical Corinthian/Composite white marble column capital with astragal necking ring, calyx bell, carved acanthus leaf fronds, corner volute scrolls, rosette fleurons, and molded square abacus table

# 1. Astragal necking ring & central calyx bell body (Y: 0.0 to 8.5)
c('necking_ring', [-4.5, 0.0, -4.5], [4.5, 1.8, 4.5], 'quartz_smooth')
c('calyx_body', [-3.5, 1.8, -3.5], [3.5, 8.5, 3.5], 'quartz_fluted')

# 2. 4 Corner carved acanthus leaf fronds (Y: 1.8 to 5.0)
c('leaf_nw', [-5.0, 1.8, -5.0], [-3.5, 5.0, -3.5], 'quartz_chiseled')
c('leaf_ne', [3.5, 1.8, -5.0], [5.0, 5.0, -3.5], 'quartz_chiseled')
c('leaf_sw', [-5.0, 1.8, 3.5], [-3.5, 5.0, 5.0], 'quartz_chiseled')
c('leaf_se', [3.5, 1.8, 3.5], [5.0, 5.0, 5.0], 'quartz_chiseled')

# 3. 4 Cardinal leaf lobes (Y: 1.8 to 4.5)
c('lobe_n', [-2.5, 1.8, -4.2], [2.5, 4.5, -3.5], 'quartz_chiseled')
c('lobe_s', [-2.5, 1.8, 3.5], [2.5, 4.5, 4.2], 'quartz_chiseled')
c('lobe_w', [-4.2, 1.8, -2.5], [-3.5, 4.5, 2.5], 'quartz_chiseled')
c('lobe_e', [3.5, 1.8, -2.5], [4.2, 4.5, 2.5], 'quartz_chiseled')

# 4. 4 Corner volute scrolls flaring outward under abacus (Y: 6.0 to 8.5)
c('volute_nw', [-6.0, 6.0, -6.0], [-3.5, 8.5, -3.5], 'quartz_bricks')
c('volute_ne', [3.5, 6.0, -6.0], [6.0, 8.5, -3.5], 'quartz_bricks')
c('volute_sw', [-6.0, 6.0, 3.5], [-3.5, 8.5, 6.0], 'quartz_bricks')
c('volute_se', [3.5, 6.0, 3.5], [6.0, 8.5, 6.0], 'quartz_bricks')

# 5. Rosette fleurons (Y: 6.5 to 8.2)
c('fleuron_n', [-1.2, 6.5, -4.2], [1.2, 8.2, -3.5], 'quartz_chiseled')
c('fleuron_s', [-1.2, 6.5, 3.5], [1.2, 8.2, 4.2], 'quartz_chiseled')

# 6. Molded abacus upper slabs (Y: 8.5 to 11.5)
c('abacus_lower', [-6.5, 8.5, -6.5], [6.5, 9.8, 6.5], 'quartz_smooth')
c('abacus_upper', [-7.0, 9.8, -7.0], [7.0, 11.5, 7.0], 'quartz_smooth')

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
    'reference': 'https://www.shutterstock.com/search/corinthian-column-capital, https://www.alamy.com/stock-photo/classical-white-marble-capital.html',
    'used': 'heaven sanctuary neoclassical column capital with astragal necking ring, calyx bell, corner acanthus leaf fronds, cardinal lobes, corner volutes, rosette fleurons, and molded square abacus table',
    'limitations': [
        'modular 14-unit wide classical column capital fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, quartz_bricks pixels unchanged; pristine and crystalline-cracked variants'
    ]
}

D = build('column_capital', cs, a, regions, plan, area='heaven')

checker(D, [0, 5.5, 0], [20, 20, 20])
views(D, [0, 5.5, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'volute_close': [4.0, 7.0, 8.0],
    'leaves_close': [0, 3.5, 8.0]
})

# Create crystalline-cracked variant texture and views
im_cracked = Image.open(D/'column_capital.png').convert('RGBA')
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
im_cracked.save(D/'column_capital_cracked.png')
(D/'column_capital_pristine.png').write_bytes((D/'column_capital.png').read_bytes())

call('create_texture', {'name': 'column_capital_cracked', 'data': str(D/'column_capital_cracked.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'column_capital_cracked'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 5.5, 0], {
        'front_cracked': [0, 6.0, 18],
        'three_quarter_cracked': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('column_capital', 'Column capital', 'White arch', 'Damaged bridge edge', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['pristine', 'crystalline_cracked'],
    'textures': ['column_capital.png', 'column_capital_pristine.png', 'column_capital_cracked.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'volute_close.png', 'leaves_close.png', 'front_cracked.png', 'three_quarter_cracked.png']
}, indent=2))

print("Heaven Column capital complete and verified with 100% full coverage!")
