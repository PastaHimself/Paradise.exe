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

# Heaven: Hanging fabric
# Monumental celestial sanctuary ceremonial hanging fabric banner with gilt brass wall brackets and finial suspension pole, hanging rings, gathered valence heading, undulating cascading white silk pleats, and ornamental gold hem band with fringe tassels.

# 1. Gilded brass suspension rod & mounting brackets (Y: 24.0 to 26.0)
c('mount_bracket_l', [-9.0, 24.0, 5.5], [-7.5, 26.0, 7.0], 'gilded_brass')
c('mount_bracket_r', [7.5, 24.0, 5.5], [9.0, 26.0, 7.0], 'gilded_brass')
c('suspension_pole', [-9.5, 24.5, 4.5], [9.5, 25.5, 5.5], 'gilded_brass')
c('finial_l', [-11.0, 24.2, 4.2], [-9.5, 25.8, 5.8], 'gilded_brass')
c('finial_r', [9.5, 24.2, 4.2], [11.0, 25.8, 5.8], 'gilded_brass')

# 2. Suspension rings (Y: 23.5 to 24.5)
c('ring_1', [-6.5, 23.5, 4.6], [-5.5, 24.5, 5.4], 'gilded_brass')
c('ring_2', [-2.5, 23.5, 4.6], [-1.5, 24.5, 5.4], 'gilded_brass')
c('ring_3', [1.5, 23.5, 4.6], [2.5, 24.5, 5.4], 'gilded_brass')
c('ring_4', [5.5, 23.5, 4.6], [6.5, 24.5, 5.4], 'gilded_brass')

# 3. Draping fabric textile folds (Y: 5.0 to 23.5)
c('valence', [-7.5, 22.0, 4.5], [7.5, 23.5, 5.5], 'white_silk')
c('pleat_left', [-7.0, 5.0, 4.8], [-2.5, 22.0, 5.6], 'white_silk')
c('pleat_center', [-2.5, 5.0, 4.4], [2.5, 22.0, 5.2], 'white_silk')
c('pleat_right', [2.5, 5.0, 4.8], [7.0, 22.0, 5.6], 'white_silk')

# 4. Gilded ornamental hem & fringe tassels (Y: 2.0 to 5.0)
c('hem_band', [-7.0, 3.8, 4.5], [7.0, 5.0, 5.5], 'gilded_brass')
c('fringe_tassels', [-6.5, 2.0, 4.7], [6.5, 3.8, 5.3], 'gilded_brass')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'white_silk': (0, 0, 'wool_colored_white.png', 32, 32),
    'gilded_brass': (32, 0, 'gilded_blackstone.png', 32, 16),
    'calcite': (0, 32, 'calcite.png', 16, 16),
    'silver_wool': (16, 32, 'wool_colored_silver.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-hanging-ceremonial-banner-fabric, https://www.alamy.com/stock-photo/antique-temple-drapery-tapestry.html',
    'used': 'heaven sanctuary hanging fabric monumental celestial sanctuary ceremonial hanging fabric banner with gilt brass wall brackets and finial suspension pole, hanging rings, gathered valence heading, undulating cascading white silk pleats, and ornamental gold hem band with fringe tassels',
    'limitations': [
        'modular 22-unit wide ceremonial hanging banner fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original wool_colored_white, gilded_blackstone, calcite, wool_colored_silver pixels unchanged; clean and disturbed/tattered texture variants'
    ]
}

D = build('hanging_fabric', cs, a, regions, plan, area='heaven')

checker(D, [0, 14.0, 5.5], [24, 26, 16])
views(D, [0, 14.0, 5.5], {
    'front': [0, 14.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'pole_close': [0, 24.5, 10.0],
    'fringe_close': [0, 4.0, 10.0]
})

# Create disturbed / tattered texture variant
im_disturbed = Image.open(D/'hanging_fabric.png').convert('RGBA')
for xx in (0, 16):
    for yy in (0, 16):
        im_disturbed.paste(Image.open(S/'wool_colored_silver.png').convert('RGBA'), (xx, yy)) # aged tarnished fabric
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # weathered tarnished rod
im_disturbed.save(D/'hanging_fabric_disturbed.png')
(D/'hanging_fabric_clean.png').write_bytes((D/'hanging_fabric.png').read_bytes())

call('create_texture', {'name': 'hanging_fabric_disturbed', 'data': str(D/'hanging_fabric_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'hanging_fabric_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 14.0, 5.5], {
        'front_disturbed': [0, 14.0, 22],
        'three_quarter_disturbed': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('hanging_fabric', 'Hanging fabric', 'Seal pedestal', 'Seal face', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['hanging_fabric.png', 'hanging_fabric_clean.png', 'hanging_fabric_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'pole_close.png', 'fringe_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Hanging fabric complete and verified with 100% full coverage!")
