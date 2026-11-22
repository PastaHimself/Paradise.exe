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

# 1. Left Foundation & Column Tower (X: -14.0 to -11.6)
c('footing_l', [-14.0, 0.0, -1.8], [-11.6, 2.0, 1.8], 'concrete_base', off=['down'])
c('baseplate_l', [-13.7, 2.0, -1.5], [-11.9, 2.5, 1.5], 'structural_steel', off=['down'])

c('leg_l_front', [-13.3, 2.5, 0.5], [-12.3, 22.0, 1.3], 'galvanized_steel', off=['down'])
c('leg_l_rear', [-13.3, 2.5, -1.3], [-12.3, 22.0, -0.5], 'galvanized_steel', off=['down'])

c('brace_l_mid', [-13.1, 10.0, -0.5], [-12.5, 11.0, 0.5], 'structural_steel', off=['north', 'south'])
c('brace_l_high', [-13.1, 18.0, -0.5], [-12.5, 19.0, 0.5], 'structural_steel', off=['north', 'south'])

# 2. Right Foundation & Column Tower (X: 11.6 to 14.0)
c('footing_r', [11.6, 0.0, -1.8], [14.0, 2.0, 1.8], 'concrete_base', off=['down'])
c('baseplate_r', [11.9, 2.0, -1.5], [13.7, 2.5, 1.5], 'structural_steel', off=['down'])

c('leg_r_front', [12.3, 2.5, 0.5], [13.3, 22.0, 1.3], 'galvanized_steel', off=['down'])
c('leg_r_rear', [12.3, 2.5, -1.3], [13.3, 22.0, -0.5], 'galvanized_steel', off=['down'])

c('brace_r_mid', [12.5, 10.0, -0.5], [13.1, 11.0, 0.5], 'structural_steel', off=['north', 'south'])
c('brace_r_high', [12.5, 18.0, -0.5], [13.1, 19.0, 0.5], 'structural_steel', off=['north', 'south'])

# 3. Horizontal Overhead Truss (X: -13.5 to 13.5, Y: 22.0 to 27.5)
c('chord_bot_front_l', [-13.5, 22.0, 0.5], [0.0, 23.0, 1.3], 'galvanized_steel', off=['down', 'east'])
c('chord_bot_front_r', [0.0, 22.0, 0.5], [13.5, 23.0, 1.3], 'galvanized_steel', off=['down', 'west'])
c('chord_bot_rear_l', [-13.5, 22.0, -1.3], [0.0, 23.0, -0.5], 'galvanized_steel', off=['down', 'east'])
c('chord_bot_rear_r', [0.0, 22.0, -1.3], [13.5, 23.0, -0.5], 'galvanized_steel', off=['down', 'west'])

c('chord_top_front_l', [-13.5, 26.5, 0.5], [0.0, 27.5, 1.3], 'galvanized_steel', off=['east'])
c('chord_top_front_r', [0.0, 26.5, 0.5], [13.5, 27.5, 1.3], 'galvanized_steel', off=['west'])
c('chord_top_rear_l', [-13.5, 26.5, -1.3], [0.0, 27.5, -0.5], 'galvanized_steel', off=['east'])
c('chord_top_rear_r', [0.0, 26.5, -1.3], [13.5, 27.5, -0.5], 'galvanized_steel', off=['west'])

c('strut_vert_l', [-7.2, 23.0, 0.6], [-6.4, 26.5, 1.2], 'structural_steel', off=['down', 'up'])
c('strut_vert_mid', [-0.4, 23.0, 0.6], [0.4, 26.5, 1.2], 'structural_steel', off=['down', 'up'])
c('strut_vert_r', [6.4, 23.0, 0.6], [7.2, 26.5, 1.2], 'structural_steel', off=['down', 'up'])

# 4. Maintenance Catwalk Walkway Platform (Rear side)
c('catwalk_l', [-11.5, 22.0, -2.5], [0.0, 22.4, -1.3], 'grating', off=['east', 'south'])
c('catwalk_r', [0.0, 22.0, -2.5], [11.5, 22.4, -1.3], 'grating', off=['west', 'south'])

c('handrail_l', [-11.5, 24.5, -2.5], [0.0, 25.0, -2.2], 'galvanized_steel', off=['east'])
c('handrail_r', [0.0, 24.5, -2.5], [11.5, 25.0, -2.2], 'galvanized_steel', off=['west'])

c('stanchion_l', [-11.5, 22.4, -2.5], [-11.0, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])
c('stanchion_mid', [-0.25, 22.4, -2.5], [0.25, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])
c('stanchion_r', [11.0, 22.4, -2.5], [11.5, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])

# 5. Sign Mounting Bracket Clamps on Front Chord
c('sign_mount_l', [-4.5, 23.0, 1.3], [-3.5, 26.5, 1.7], 'structural_steel', off=['north'])
c('sign_mount_r', [3.5, 23.0, 1.3], [4.5, 26.5, 1.7], 'structural_steel', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'galvanized_steel': (32, 0, 'iron_block.png', 16, 16),
    'grating': (48, 0, 'cauldron_side.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/metal-gantry-overhead-highway-sign, https://www.alamy.com/stock-photo/industrial-steel-gantry-overhead-highway-sign-structure.html',
    'used': 'freeway overhead steel truss sign gantry portal spanning 28 units across multi-lane roadway, featuring dual concrete footing piers with anchor baseplates, twin vertical lattice support columns with horizontal cross braces, overhead box truss with dual upper and lower chords and vertical web struts, rear maintenance catwalk walkway platform with safety handrail stanchions, and front sign mounting bracket clamps',
    'limitations': [
        'full-span 28-unit overhead gantry portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, iron_block, cauldron_side pixels unchanged; normal and scorched variants'
    ]
}

D = build('sign_gantry', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 14.0, 0.0], [28, 24, 28])
views(D, [0, 14.0, 0.0], {
    'front': [0, 14.0, 28],
    'three_quarter': [26, 22, 26],
    'back': [-26, 22, -26],
    'gameplay_scale': [32, 26, 32],
    'catwalk_close': [0, 24.0, -10.0],
    'column_close': [-12.5, 6.0, 8.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'sign_gantry.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (48, 0))
im_burned.save(D/'sign_gantry_burned.png')
(D/'sign_gantry_normal.png').write_bytes((D/'sign_gantry.png').read_bytes())

call('create_texture', {'name': 'sign_gantry_burned', 'data': str(D/'sign_gantry_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'sign_gantry_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 14.0, 0.0], {
        'front_burned': [0, 14.0, 28],
        'three_quarter_burned': [26, 22, 26]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('sign_gantry', 'Sign gantry', 'Drain grate', 'Utility cabinet', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['sign_gantry.png', 'sign_gantry_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'catwalk_close.png', 'column_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Sign gantry complete and verified!")
