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

# 1. Concrete Tunnel Wall Frame
c('wall_left', [-8.0, 0.0, -1.0], [-5.0, 20.0, 1.0], 'concrete_wall', off=['down', 'east'])
c('wall_right', [5.0, 0.0, -1.0], [8.0, 20.0, 1.0], 'concrete_wall', off=['down', 'west'])
c('wall_lintel', [-5.0, 18.0, -1.0], [5.0, 20.0, 1.0], 'concrete_wall', off=['down', 'east', 'west'])
c('wall_sill', [-5.0, 0.0, -1.0], [5.0, 1.0, 1.0], 'concrete_wall', off=['down', 'east', 'west'])

# 2. Heavy Structural Steel Door Frame Casing
c('jamb_left', [-5.0, 1.0, -0.6], [-4.2, 18.0, 1.2], 'structural_steel', off=['down', 'up', 'west'])
c('jamb_right', [4.2, 1.0, -0.6], [5.0, 18.0, 1.2], 'structural_steel', off=['down', 'up', 'east'])
c('head_casing', [-4.2, 17.2, -0.6], [4.2, 18.0, 1.2], 'structural_steel', off=['up', 'east', 'west'])
c('sill_kickplate', [-4.2, 1.0, -0.6], [4.2, 1.6, 1.2], 'structural_steel', off=['down', 'east', 'west'])

# 3. Door Leaf Body
c('door_leaf', [-4.2, 1.6, 0.0], [4.2, 17.2, 0.8], 'steel_leaf', off=['down', 'up', 'east', 'west'])

# 4. Alternating Hazard Stripes
c('stripe_1_y', [-4.0, 1.6, 0.8], [4.0, 4.2, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_2_b', [-4.0, 4.2, 0.8], [4.0, 6.8, 1.0], 'hazard_black', off=['north', 'down'])
c('stripe_3_y', [-4.0, 6.8, 0.8], [4.0, 9.4, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_4_b', [-4.0, 9.4, 0.8], [4.0, 12.0, 1.0], 'hazard_black', off=['north', 'down'])
c('stripe_5_y', [-4.0, 12.0, 0.8], [4.0, 14.6, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_6_b', [-4.0, 14.6, 0.8], [4.0, 17.2, 1.0], 'hazard_black', off=['north', 'down', 'up'])

# 5. Panic Hardware & Hinges
c('panic_bar', [-3.2, 8.8, 1.0], [3.2, 9.6, 1.4], 'hardware', off=['north', 'west', 'east'])
c('panic_mount_l', [-3.6, 8.6, 1.0], [-3.2, 9.8, 1.3], 'hardware', off=['north'])
c('panic_mount_r', [3.2, 8.6, 1.0], [3.6, 9.8, 1.3], 'hardware', off=['north'])

c('hinge_upper', [-4.8, 14.5, 1.2], [-4.2, 16.0, 1.5], 'hardware', off=['north'])
c('hinge_lower', [-4.8, 2.5, 1.2], [-4.2, 4.0, 1.5], 'hardware', off=['north'])

# 6. Overhead Emergency Access Light
c('emergency_light', [-1.2, 18.4, 1.0], [1.2, 19.4, 1.6], 'light_fixture', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_wall': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'steel_leaf': (32, 0, 'iron_block.png', 16, 16),
    'hazard_yellow': (48, 0, 'concrete_yellow.png', 16, 16),
    'hazard_black': (0, 16, 'concrete_black.png', 16, 16),
    'hardware': (16, 16, 'raw_iron_block.png', 16, 16),
    'light_fixture': (32, 16, 'sea_lantern.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/black-and-yellow-diagonal-striped-hazard-warning-tape-pattern-industrial-door, https://www.alamy.com/stock-photo/full-frame-black-and-bright-yellow-diagonal-warning-stripes-painted-on-an-industrial-door.html',
    'used': 'freeway tunnel hazard-striped emergency egress service door with cast concrete portal reveal, structural steel frame jambs, head casing, and kickplate threshold, heavy steel door leaf with high-visibility alternating black and yellow safety chevron warning stripes, commercial emergency panic exit push bar with mounting brackets, heavy-duty industrial barrel hinges, and overhead illuminated green/white emergency egress beacon light',
    'limitations': [
        'modular 20-unit high tunnel utility service door portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, iron_block, concrete_yellow, concrete_black, raw_iron_block, sea_lantern pixels unchanged; normal and scorched variants'
    ]
}

D = build('hazard_striped_service_door', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 10.0, 0.0], [22, 18, 22])
views(D, [0, 10.0, 0.0], {
    'front': [0, 10.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [24, 22, 24],
    'panic_bar_close': [0, 9.2, 8.0],
    'hinge_close': [-4.5, 15.0, 6.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'hazard_striped_service_door.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (16, 16))
im_burned.paste(Image.open(S/'quartz_block_side.png').convert('RGBA'), (32, 16))
im_burned.save(D/'hazard_striped_service_door_burned.png')
(D/'hazard_striped_service_door_normal.png').write_bytes((D/'hazard_striped_service_door.png').read_bytes())

call('create_texture', {'name': 'hazard_striped_service_door_burned', 'data': str(D/'hazard_striped_service_door_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'hazard_striped_service_door_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 0.0], {
        'front_burned': [0, 10.0, 22],
        'three_quarter_burned': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('hazard_striped_service_door', 'Hazard-striped service door', 'Sheltered turnout', 'Heat damage overlays', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['hazard_striped_service_door.png', 'hazard_striped_service_door_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'panic_bar_close.png', 'hinge_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Hazard-striped service door complete and verified!")
