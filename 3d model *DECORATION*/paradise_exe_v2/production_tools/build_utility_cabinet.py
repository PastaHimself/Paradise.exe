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

# 1. Concrete Footing Pad
c('footing_pad', [-6.0, 0.0, -5.0], [6.0, 2.0, 5.0], 'concrete_base', off=['down'])
c('base_flange', [-5.4, 2.0, -4.4], [5.4, 2.5, 4.4], 'structural_steel', off=['down'])

# 2. Main Aluminum Cabinet Body (Y: 2.5 to 17.0)
c('cabinet_body', [-5.0, 2.5, -4.0], [5.0, 17.0, 4.0], 'aluminum_body', off=['down'])

# 3. Sloped Weather Canopy Roof (Y: 17.0 to 18.0)
c('canopy_roof', [-5.5, 17.0, -4.5], [5.5, 18.0, 4.5], 'aluminum_body', off=['down'])
c('exhaust_shroud', [-2.5, 18.0, -2.5], [2.5, 19.0, 2.5], 'structural_steel', off=['down'])

# 4. Front Service Door
c('door_front', [-4.5, 3.0, 4.0], [4.5, 16.5, 4.4], 'aluminum_body', off=['north'])
c('louver_front', [-3.5, 4.0, 4.4], [3.5, 6.5, 4.7], 'louver_grille', off=['north'])
c('latch_handle', [3.2, 9.5, 4.4], [4.0, 11.5, 4.8], 'hardware', off=['north'])
c('hinge_upper', [-4.9, 13.5, 4.0], [-4.5, 15.5, 4.5], 'hardware', off=['north', 'east'])
c('hinge_lower', [-4.9, 4.0, 4.0], [-4.5, 6.0, 4.5], 'hardware', off=['north', 'east'])
c('police_door', [-2.0, 12.5, 4.4], [1.0, 15.0, 4.6], 'structural_steel', off=['north'])

# 5. Side Louver Filter Hoods
c('louver_left', [-5.3, 8.0, -2.5], [-5.0, 14.0, 2.5], 'louver_grille', off=['east'])
c('louver_right', [5.0, 8.0, -2.5], [5.3, 14.0, 2.5], 'louver_grille', off=['west'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'aluminum_body': (32, 0, 'iron_block.png', 16, 16),
    'louver_grille': (48, 0, 'cauldron_side.png', 16, 16),
    'hardware': (0, 16, 'raw_iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.alamy.com/stock-photo/roadside-utility-cabinet.html, https://www.dreamstime.com/photos-images/traffic-signal-controller-cabinet.html',
    'used': 'freeway roadside ITS traffic signal controller utility cabinet with cast concrete foundation footing pad, anchor mounting base flange, weather-resistant brushed aluminum enclosure body, overhanging canopy rain drip roof with exhaust fan cowl, front gasketed service door with louvered intake vents, three-point latch handle and heavy-duty hinges, police auxiliary emergency door, and dual side cooling louvers',
    'limitations': [
        'modular 19-unit high roadside utility cabinet fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, iron_block, cauldron_side, raw_iron_block pixels unchanged; normal and scorched variants'
    ]
}

D = build('utility_cabinet', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 9.5, 0.0], [20, 16, 20])
views(D, [0, 9.5, 0.0], {
    'front': [0, 9.5, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [24, 22, 24],
    'door_latch_close': [3.5, 10.5, 10.0],
    'louver_close': [-5.0, 11.0, 8.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'utility_cabinet.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (0, 16))
im_burned.save(D/'utility_cabinet_burned.png')
(D/'utility_cabinet_normal.png').write_bytes((D/'utility_cabinet.png').read_bytes())

call('create_texture', {'name': 'utility_cabinet_burned', 'data': str(D/'utility_cabinet_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'utility_cabinet_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.5, 0.0], {
        'front_burned': [0, 9.5, 20],
        'three_quarter_burned': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('utility_cabinet', 'Utility cabinet', 'Expansion joint', 'Emergency phone box', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['utility_cabinet.png', 'utility_cabinet_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'door_latch_close.png', 'louver_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Utility cabinet complete and verified!")
