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

# Heaven: Garden edging
# Modular classical white quartz marble garden pathway curb border with compacted soil bedding, stepped molded torus base, fluted coping rail, flanking interlocking terminal boss blocks, and subtle pale moss/plant accents.

# 1. Base bedding & plinth (Y: 0.0 to 2.0)
c('gravel_bedding', [-8.0, 0.0, -3.0], [8.0, 0.8, 3.0], 'rich_dirt')
c('marble_plinth', [-8.0, 0.8, -2.5], [8.0, 2.0, 2.5], 'quartz_marble')

# 2. Lower molded torus (Y: 2.0 to 3.2)
c('curb_molding', [-6.5, 2.0, -2.0], [6.5, 3.2, 2.0], 'quartz_marble')

# 3. Fluted coping rail (Y: 3.2 to 4.5)
c('curb_coping', [-6.5, 3.2, -1.5], [6.5, 4.5, 1.5], 'fluted_curb')

# 4. Terminal joint bosses (Y: 2.0 to 5.0)
c('terminal_boss_w', [-8.0, 2.0, -2.2], [-6.5, 5.0, 2.2], 'chiseled_relief')
c('terminal_boss_e', [6.5, 2.0, -2.2], [8.0, 5.0, 2.2], 'chiseled_relief')

# 5. Little roadside plant accents (Y: 0.8 to 2.2)
c('plant_accent_l', [-3.5, 0.8, 2.5], [-1.5, 2.2, 3.0], 'calcite_plants')
c('plant_accent_r', [1.5, 0.8, 2.5], [3.5, 2.2, 3.0], 'calcite_plants')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_curb': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_relief': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'rich_dirt': (48, 0, 'dirt.png', 16, 16),
    'calcite_plants': (0, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-marble-garden-edging-curb, https://www.alamy.com/stock-photo/antique-stone-garden-curb.html',
    'used': 'heaven sanctuary garden edging modular classical white quartz marble garden pathway curb border with compacted soil bedding, stepped molded torus base, fluted coping rail, flanking interlocking terminal boss blocks, and subtle pale moss/plant accents',
    'limitations': [
        'modular 16-unit long garden border edging fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, dirt, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('garden_edging', cs, a, regions, plan, area='heaven')

checker(D, [0, 2.5, 0], [20, 12, 16])
views(D, [0, 2.5, 0], {
    'front': [0, 6.0, 16],
    'three_quarter': [16, 12, 16],
    'back': [-16, 12, -16],
    'gameplay_scale': [22, 16, 22],
    'boss_close': [7.0, 3.5, 6.0],
    'coping_close': [0, 4.0, 6.0]
})

# Create disturbed / weathered texture variant
im_disturbed = Image.open(D/'garden_edging.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble
im_disturbed.paste(Image.open(S/'dirt_with_roots.png').convert('RGBA'), (48, 0)) # rooty dirt
im_disturbed.paste(Image.open(S/'deadbush.png').convert('RGBA'), (0, 16)) # withered plant accents
im_disturbed.save(D/'garden_edging_disturbed.png')
(D/'garden_edging_clean.png').write_bytes((D/'garden_edging.png').read_bytes())

call('create_texture', {'name': 'garden_edging_disturbed', 'data': str(D/'garden_edging_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'garden_edging_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.5, 0], {
        'front_disturbed': [0, 6.0, 16],
        'three_quarter_disturbed': [16, 12, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('garden_edging', 'Garden edging', 'Fountain rim', 'Temple pedestal', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['garden_edging.png', 'garden_edging_clean.png', 'garden_edging_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'boss_close.png', 'coping_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Garden edging complete and verified with 100% full coverage!")
