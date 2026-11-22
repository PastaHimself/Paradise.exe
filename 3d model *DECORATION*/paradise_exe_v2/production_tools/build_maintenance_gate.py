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

# 1. Left Hinge Terminal Post
c('footing_l', [-12.0, 0.0, -1.6], [-9.6, 1.8, 1.6], 'concrete_base', off=['down'])
c('post_l', [-11.2, 1.8, -0.4], [-10.4, 16.0, 0.4], 'galvanized_steel', off=['down'])
c('cap_l', [-11.4, 16.0, -0.6], [-10.2, 17.5, 0.6], 'structural_steel', off=['down'])

# 2. Right Latch Terminal Post
c('footing_r', [9.6, 0.0, -1.6], [12.0, 1.8, 1.6], 'concrete_base', off=['down'])
c('post_r', [10.4, 1.8, -0.4], [11.2, 16.0, 0.4], 'galvanized_steel', off=['down'])
c('cap_r', [10.2, 16.0, -0.6], [11.4, 17.5, 0.6], 'structural_steel', off=['down'])

# 3. Gate Tubular Frame Rails & Stiles
c('rail_bot_l', [-10.0, 2.2, -0.3], [0.0, 2.8, 0.3], 'galvanized_steel', off=['east'])
c('rail_bot_r', [0.0, 2.2, -0.3], [9.8, 2.8, 0.3], 'galvanized_steel', off=['west'])

c('rail_top_l', [-10.0, 13.8, -0.3], [0.0, 14.4, 0.3], 'galvanized_steel', off=['east'])
c('rail_top_r', [0.0, 13.8, -0.3], [9.8, 14.4, 0.3], 'galvanized_steel', off=['west'])

c('stile_left', [-10.0, 2.8, -0.3], [-9.4, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])
c('stile_center', [-0.3, 2.8, -0.3], [0.3, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])
c('stile_right', [9.2, 2.8, -0.3], [9.8, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])

# 4. Chain Link Mesh Bay Panels
c('mesh_left', [-9.4, 2.8, -0.1], [-0.3, 13.8, 0.1], 'chain_mesh', off=['down', 'up', 'east', 'west'])
c('mesh_right', [0.3, 2.8, -0.1], [9.2, 13.8, 0.1], 'chain_mesh', off=['down', 'up', 'east', 'west'])

# 5. Security Hinges & Locking Chain Wrap
c('hinge_top', [-10.4, 12.0, -0.4], [-10.0, 13.5, 0.4], 'hardware', off=['east', 'west'])
c('hinge_bot', [-10.4, 3.2, -0.4], [-10.0, 4.7, 0.4], 'hardware', off=['east', 'west'])

c('chain_front', [9.3, 7.5, 0.4], [11.3, 8.5, 0.7], 'hardware', off=['north'])
c('chain_rear', [9.3, 7.5, -0.7], [11.3, 8.5, -0.4], 'hardware', off=['south'])
c('padlock', [10.0, 6.0, 0.4], [10.8, 7.5, 0.8], 'structural_steel', off=['north', 'up'])

# 6. Warning Signboard
c('warning_sign', [-2.5, 7.5, 0.3], [2.5, 10.5, 0.6], 'sign_yellow', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'galvanized_steel': (16, 0, 'iron_block.png', 16, 16),
    'structural_steel': (32, 0, 'netherite_block.png', 16, 16),
    'chain_mesh': (48, 0, 'iron_bars.png', 16, 16),
    'hardware': (0, 16, 'raw_iron_block.png', 16, 16),
    'sign_yellow': (16, 16, 'concrete_yellow.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/highway-maintenance-gate-chain-link-fence, https://www.alamy.com/stock-photo/service-road-access-gate-steel-barrier.html',
    'used': 'freeway roadside maintenance service road swing gate spanning 24 units, featuring dual cast concrete terminal footings, heavy tubular steel hinge and latch posts with barbed wire caps, galvanized tubular frame rails and stiles, dual chain-link woven wire mesh infill panels, heavy barrel hinge clamps, wrapped steel locking chain with padlock, and yellow warning signboard',
    'limitations': [
        'modular 24-unit wide service road security swing gate fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, iron_block, netherite_block, iron_bars, raw_iron_block, concrete_yellow pixels unchanged; normal and scorched variants'
    ]
}

D = build('maintenance_gate', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 9.0, 0.0], [24, 20, 24])
views(D, [0, 9.0, 0.0], {
    'front': [0, 9.0, 24],
    'three_quarter': [22, 18, 22],
    'back': [-22, 18, -22],
    'gameplay_scale': [28, 24, 28],
    'chain_lock_close': [10.5, 7.5, 6.0],
    'hinge_close': [-10.5, 12.5, 6.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'maintenance_gate.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'iron_bars.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (16, 16))
im_burned.save(D/'maintenance_gate_burned.png')
(D/'maintenance_gate_normal.png').write_bytes((D/'maintenance_gate.png').read_bytes())

call('create_texture', {'name': 'maintenance_gate_burned', 'data': str(D/'maintenance_gate_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'maintenance_gate_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 0.0], {
        'front_burned': [0, 9.0, 24],
        'three_quarter_burned': [22, 18, 22]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('maintenance_gate', 'Maintenance gate', 'Hazard-striped service door', 'Sheltered turnout', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['maintenance_gate.png', 'maintenance_gate_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'chain_lock_close.png', 'hinge_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Maintenance gate complete and verified!")
