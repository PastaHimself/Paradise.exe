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

# Heaven: White chest casing
# Monumental neoclassical carved white marble storage coffer casing with molded plinth footing, corner pilasters, relief frieze panel, molded rim, gabled lid, and brass lock hasp

# 1. Plinth footing base (Y: 0.0 to 1.5)
c('plinth', [-8.0, 0.0, -6.0], [8.0, 1.5, 6.0], 'quartz_smooth')

# 2. 4 Corner pilasters (Y: 1.5 to 8.5)
c('post_nw', [-7.5, 1.5, -5.5], [-6.5, 8.5, -4.5], 'quartz_fluted')
c('post_ne', [6.5, 1.5, -5.5], [7.5, 8.5, -4.5], 'quartz_fluted')
c('post_sw', [-7.5, 1.5, 4.5], [-6.5, 8.5, 5.5], 'quartz_fluted')
c('post_se', [6.5, 1.5, 4.5], [7.5, 8.5, 5.5], 'quartz_fluted')

# 3. 4 Walls between corner posts (Y: 1.5 to 8.5)
c('wall_n', [-6.5, 1.5, -5.5], [6.5, 8.5, -4.5], 'quartz_bricks')
c('wall_s', [-6.5, 1.5, 4.5], [6.5, 8.5, 5.5], 'quartz_bricks')
c('wall_w', [-7.5, 1.5, -4.5], [-6.5, 8.5, 4.5], 'quartz_bricks')
c('wall_e', [6.5, 1.5, -4.5], [7.5, 8.5, 4.5], 'quartz_bricks')

# 4. Interior floor slab (Y: 1.5 to 2.5)
c('floor_slab', [-6.5, 1.5, -4.5], [6.5, 2.5, 4.5], 'quartz_smooth')

# 5. Front relief frieze panel (Y: 3.0 to 7.0, Z: 5.5 to 5.8)
c('panel_front', [-5.5, 3.0, 5.5], [5.5, 7.0, 5.8], 'quartz_chiseled')

# 6. Molded chest rim / cornice (Y: 8.5 to 9.5)
c('rim', [-8.0, 8.5, -6.0], [8.0, 9.5, 6.0], 'quartz_smooth')

# 7. Gabled chest lid (Y: 9.5 to 12.0)
c('lid_base', [-7.5, 9.5, -5.5], [7.5, 10.5, 5.5], 'quartz_smooth')
c('lid_apex', [-5.5, 10.5, -3.5], [5.5, 12.0, 3.5], 'quartz_chiseled')

# 8. Gilt brass lock hasp escutcheon (Y: 6.5 to 9.8, Z: 6.0 to 6.4)
c('lock_hasp', [-0.8, 6.5, 6.0], [0.8, 9.8, 6.4], 'brass_hasp')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_bricks': (16, 0, 'quartz_bricks.png', 16, 16),
    'quartz_fluted': (32, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'brass_hasp': (0, 16, 'gilded_blackstone.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-white-marble-chest, https://www.alamy.com/stock-photo/ancient-marble-coffer-box.html',
    'used': 'heaven sanctuary white chest casing monumental neoclassical marble storage coffer with molded plinth footing, corner pilasters, relief frieze, molded rim, gabled lid, and brass lock hasp',
    'limitations': [
        'modular 16-unit wide white storage chest casing fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_bricks, quartz_block_lines, quartz_block_chiseled, gilded_blackstone pixels unchanged; clean and disturbed texture variants'
    ]
}

D = build('white_chest_casing', cs, a, regions, plan, area='heaven')

checker(D, [0, 6.0, 0], [22, 20, 22])
views(D, [0, 6.0, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'hasp_close': [0, 8.0, 9.0],
    'lid_close': [0, 11.0, 8.0]
})

# Create disturbed texture variant (stained, micro-fissured crystalline marble)
im_disturbed = Image.open(D/'white_chest_casing.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
im_disturbed.save(D/'white_chest_casing_disturbed.png')
(D/'white_chest_casing_clean.png').write_bytes((D/'white_chest_casing.png').read_bytes())

call('create_texture', {'name': 'white_chest_casing_disturbed', 'data': str(D/'white_chest_casing_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'white_chest_casing_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 6.0, 0], {
        'front_disturbed': [0, 6.0, 18],
        'three_quarter_disturbed': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('white_chest_casing', 'White chest casing', 'Disturbed white chest geometry', 'Rest wall lamp', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['white_chest_casing.png', 'white_chest_casing_clean.png', 'white_chest_casing_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'hasp_close.png', 'lid_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven White chest casing complete and verified with 100% full coverage!")
