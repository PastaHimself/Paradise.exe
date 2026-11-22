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

# Heaven: White arch
# Monumental neoclassical semicircular arched portal with molded pier plinths, ashlar jambs, impost capitals, stepped voussoirs, projecting keystones, and molded cornice entablature

# 1. Left pier / jamb (west) (Y: 0.0 to 16.0)
c('plinth_left', [-12.0, 0.0, -4.0], [-7.0, 2.5, 4.0], 'quartz_smooth')
c('jamb_left', [-11.5, 2.5, -3.5], [-7.5, 14.0, 3.5], 'quartz_bricks')
c('impost_left', [-12.0, 14.0, -4.0], [-7.0, 16.0, 4.0], 'quartz_smooth')

# 2. Right pier / jamb (east) (Y: 0.0 to 16.0)
c('plinth_right', [7.0, 0.0, -4.0], [12.0, 2.5, 4.0], 'quartz_smooth')
c('jamb_right', [7.5, 2.5, -3.5], [11.5, 14.0, 3.5], 'quartz_bricks')
c('impost_right', [7.0, 14.0, -4.0], [12.0, 16.0, 4.0], 'quartz_smooth')

# 3. Semicircular arch voussoirs (Y: 16.0 to 25.5)
c('spring_left', [-8.0, 16.0, -3.5], [-5.5, 19.0, 3.5], 'quartz_fluted')
c('spring_right', [5.5, 16.0, -3.5], [8.0, 19.0, 3.5], 'quartz_fluted')
c('haunch_left', [-6.0, 19.0, -3.5], [-3.0, 22.0, 3.5], 'quartz_fluted')
c('haunch_right', [3.0, 19.0, -3.5], [6.0, 22.0, 3.5], 'quartz_fluted')
c('shoulder_left', [-3.5, 22.0, -3.5], [-1.2, 24.5, 3.5], 'quartz_fluted')
c('shoulder_right', [1.2, 22.0, -3.5], [3.5, 24.5, 3.5], 'quartz_fluted')
c('crown_apex', [-1.2, 23.5, -3.5], [1.2, 25.5, 3.5], 'quartz_fluted')

# 4. Projected decorative keystones projecting north & south (Y: 22.5 to 25.5)
c('keystone_n', [-1.5, 22.5, -4.2], [1.5, 25.5, -3.5], 'quartz_chiseled')
c('keystone_s', [-1.5, 22.5, 3.5], [1.5, 25.5, 4.2], 'quartz_chiseled')

# 5. Upper entablature architrave & molded cornice shelf (Y: 25.5 to 28.0)
c('architrave', [-12.0, 25.5, -3.8], [12.0, 26.8, 3.8], 'quartz_smooth')
c('cornice', [-12.5, 26.8, -4.2], [12.5, 28.0, 4.2], 'quartz_smooth')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_bricks': (16, 0, 'quartz_bricks.png', 16, 16),
    'quartz_fluted': (32, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-white-marble-arch, https://www.alamy.com/stock-photo/ancient-greek-roman-white-archway.html',
    'used': 'heaven sanctuary monumental neoclassical white arch with molded pier plinths, quartz brick jambs, impost capitals, stepped semicircular voussoirs, carved bracket keystones, and molded cornice entablature',
    'limitations': [
        'modular 25-unit wide white arch portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_bricks, quartz_block_lines, quartz_block_chiseled pixels unchanged; pristine and crystalline-cracked variants'
    ]
}

D = build('white_arch', cs, a, regions, plan, area='heaven')

checker(D, [0, 14.0, 0], [22, 24, 22])
views(D, [0, 14.0, 0], {
    'front': [0, 14.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [28, 22, 28],
    'keystone_close': [0, 24.0, 9.0],
    'impost_close': [-9.5, 15.0, 9.0]
})

# Create crystalline-cracked variant texture and views
im_cracked = Image.open(D/'white_arch.png').convert('RGBA')
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_cracked.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
im_cracked.save(D/'white_arch_cracked.png')
(D/'white_arch_pristine.png').write_bytes((D/'white_arch.png').read_bytes())

call('create_texture', {'name': 'white_arch_cracked', 'data': str(D/'white_arch_cracked.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'white_arch_cracked'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 14.0, 0], {
        'front_cracked': [0, 14.0, 22],
        'three_quarter_cracked': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('white_arch', 'White arch', 'Damaged bridge edge', 'Rest bench', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['pristine', 'crystalline_cracked'],
    'textures': ['white_arch.png', 'white_arch_pristine.png', 'white_arch_cracked.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'keystone_close.png', 'impost_close.png', 'front_cracked.png', 'three_quarter_cracked.png']
}, indent=2))

print("Heaven White arch complete and verified with 100% full coverage!")
