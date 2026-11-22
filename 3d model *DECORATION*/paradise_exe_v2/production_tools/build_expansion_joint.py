import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Road Deck Approaches
c('road_north', [-8.0, 0.0, 3.0], [8.0, 2.0, 8.0], 'asphalt', off=['down', 'north'])
c('road_south', [-8.0, 0.0, -8.0], [8.0, 2.0, -3.0], 'asphalt', off=['down', 'south'])

# 2. Steel Header Armoring Plates
c('header_north', [-8.0, 1.2, 1.8], [8.0, 2.0, 3.0], 'structural_steel', off=['down', 'south'])
c('bed_north', [-8.0, 0.0, 1.8], [8.0, 1.2, 3.0], 'concrete_bed', off=['down', 'south', 'up'])

c('header_south', [-8.0, 1.2, -3.0], [8.0, 2.0, -1.8], 'structural_steel', off=['down', 'north'])
c('bed_south', [-8.0, 0.0, -3.0], [8.0, 1.2, -1.8], 'concrete_bed', off=['down', 'north', 'up'])

# 3. Neoprene Waterstop Drainage Trough (Deep center gap Z: [-1.8, 1.8])
c('waterstop_trough', [-8.0, 0.0, -1.8], [8.0, 0.6, 1.8], 'rubber_seal', off=['down', 'north', 'south'])

# 4. North-facing Steel Finger Teeth (cantilevered south from north header at Z=1.8 down to Z=-1.2)
c('tooth_n_1', [-7.0, 1.4, -1.2], [-5.4, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_2', [-3.0, 1.4, -1.2], [-1.4, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_3', [1.0, 1.4, -1.2], [2.6, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_4', [5.0, 1.4, -1.2], [6.6, 2.0, 1.8], 'cast_steel', off=['down', 'south'])

# 5. South-facing Steel Finger Teeth (cantilevered north from south header at Z=-1.8 up to Z=1.2)
c('tooth_s_0', [-8.0, 1.4, -1.8], [-7.4, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_1', [-5.0, 1.4, -1.8], [-3.4, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_2', [-1.0, 1.4, -1.8], [0.6, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_3', [3.0, 1.4, -1.8], [4.6, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_4', [7.0, 1.4, -1.8], [8.0, 2.0, 1.2], 'cast_steel', off=['down', 'north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'asphalt': (0, 0, 'concrete_black.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'concrete_bed': (32, 0, 'stone_slab_top.png', 16, 16),
    'rubber_seal': (48, 0, 'coal_block.png', 16, 16),
    'cast_steel': (0, 16, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.alamy.com/stock-photo/structural-engineering-bridge-dilatation-joint.html, https://www.shutterstock.com/search/highway-comb-expansion-joint',
    'used': 'freeway bridge deck thermal expansion joint with asphalt roadway approaches, reinforced concrete support bedding, heavy structural steel header armoring plates, recessed neoprene waterstop trough seal, and interlocking heavy-duty cast steel cantilever finger teeth bridging the dilatation gap',
    'limitations': [
        'modular 16x16-unit roadway bridge dilatation expansion joint fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_black, netherite_block, stone_slab_top, coal_block, iron_block pixels unchanged; clean and scorched variants'
    ]
}

D = build('expansion_joint', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 1.0, 0.0], [18, 16, 18])
views(D, [0, 1.0, 0.0], {
    'front': [0, 1.0, 18],
    'three_quarter': [16, 16, 16],
    'back': [-16, 16, -16],
    'gameplay_scale': [22, 20, 22],
    'teeth_top_close': [0, 10.0, 0.5],
    'trough_close': [0, 2.0, 6.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'expansion_joint.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (0, 16))
im_burned.save(D/'expansion_joint_burned.png')
(D/'expansion_joint_normal.png').write_bytes((D/'expansion_joint.png').read_bytes())

call('create_texture', {'name': 'expansion_joint_burned', 'data': str(D/'expansion_joint_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'expansion_joint_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 1.0, 0.0], {
        'front_burned': [0, 1.0, 18],
        'three_quarter_burned': [16, 16, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('expansion_joint', 'Expansion joint', 'Emergency phone box', 'Maintenance gate', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['expansion_joint.png', 'expansion_joint_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'teeth_top_close.png', 'trough_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Expansion joint complete and verified!")
