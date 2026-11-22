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

# 1. Base Roadway / Emergency Bay Pavement (Y: 0.0 to 1.0)
c('floor_l', [-12.0, 0.0, -8.0], [0.0, 1.0, 8.0], 'asphalt', off=['down', 'east'])
c('floor_r', [0.0, 0.0, -8.0], [12.0, 1.0, 8.0], 'asphalt', off=['down', 'west'])

c('bay_line_l', [-10.0, 1.0, -7.5], [0.0, 1.15, -6.5], 'marking_yellow', off=['down', 'east'])
c('bay_line_r', [0.0, 1.0, -7.5], [10.0, 1.15, -6.5], 'marking_yellow', off=['down', 'west'])

# 2. Rear Concrete Retaining Wall (Y: 1.0 to 18.0, Z: [6.0, 8.0])
c('wall_rear_l', [-12.0, 1.0, 6.0], [0.0, 18.0, 8.0], 'concrete_wall', off=['down', 'east'])
c('wall_rear_r', [0.0, 1.0, 6.0], [12.0, 18.0, 8.0], 'concrete_wall', off=['down', 'west'])

# 3. Cantilever Overhead Canopy Roof (Y: 18.0 to 20.0, Z: [-2.0, 8.0])
c('canopy_roof_l', [-12.0, 18.0, -2.0], [0.0, 20.0, 8.0], 'concrete_wall', off=['down', 'east'])
c('canopy_roof_r', [0.0, 18.0, -2.0], [12.0, 20.0, 8.0], 'concrete_wall', off=['down', 'west'])

c('bracket_l', [-9.5, 14.0, 0.0], [-8.5, 18.0, 6.0], 'structural_steel', off=['north', 'up', 'south'])
c('bracket_r', [8.5, 14.0, 0.0], [9.5, 18.0, 6.0], 'structural_steel', off=['north', 'up', 'south'])

# 4. Crash-Protection Concrete Jersey Barriers (Left and Right returns)
c('barrier_l', [-12.0, 1.0, -6.0], [-10.0, 5.0, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])
c('barrier_r', [10.0, 1.0, -6.0], [12.0, 5.0, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])

# 5. Pedestrian Refuge Bench against rear wall
c('bench_seat', [-4.0, 1.0, 3.5], [4.0, 3.5, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])

# 6. Emergency Call Box on Wall
c('call_box', [-6.5, 5.5, 5.2], [-4.5, 9.5, 6.0], 'phone_orange', off=['north', 'south'])

# 7. Blue ERA Placard Sign on Wall
c('era_sign', [4.5, 7.0, 5.6], [7.5, 10.0, 6.0], 'era_blue', off=['north', 'south'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'asphalt': (0, 0, 'concrete_black.png', 16, 16),
    'marking_yellow': (16, 0, 'concrete_yellow.png', 16, 16),
    'concrete_wall': (32, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (48, 0, 'netherite_block.png', 16, 16),
    'concrete_barrier': (0, 16, 'stone.png', 16, 16),
    'phone_orange': (16, 16, 'concrete_orange.png', 16, 16),
    'era_blue': (32, 16, 'concrete_blue.png', 16, 16)
}

plan = {
    'reference': 'https://www.alamy.com/stock-photo/emergency-refuge-area-motorway.html, https://www.shutterstock.com/search/highway-emergency-breakdown-bay',
    'used': 'freeway sheltered emergency breakdown refuge bay turnout spanning 24 units, featuring asphalt bay floor with high-vis yellow perimeter demarcation line, rear reinforced concrete retaining wall, cantilever overhead concrete canopy shelter roof with heavy structural steel corbel brackets, flanking crash-protection Jersey concrete barriers, built-in pedestrian refuge bench, wall-mounted SOS emergency phone box, and blue ERA information placard',
    'limitations': [
        'modular 24-unit wide sheltered highway turnout bay fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_black, concrete_yellow, stone_slab_top, netherite_block, stone, concrete_orange, concrete_blue pixels unchanged; normal and scorched variants'
    ]
}

D = build('sheltered_turnout', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 10.0, 0.0], [24, 20, 24])
views(D, [0, 10.0, 0.0], {
    'front': [0, 10.0, 24],
    'three_quarter': [22, 18, 22],
    'back': [-22, 18, -22],
    'gameplay_scale': [30, 26, 30],
    'canopy_close': [0, 16.0, 10.0],
    'bench_close': [0, 4.0, 10.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'sheltered_turnout.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (16, 16))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (32, 16))
im_burned.save(D/'sheltered_turnout_burned.png')
(D/'sheltered_turnout_normal.png').write_bytes((D/'sheltered_turnout.png').read_bytes())

call('create_texture', {'name': 'sheltered_turnout_burned', 'data': str(D/'sheltered_turnout_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'sheltered_turnout_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 0.0], {
        'front_burned': [0, 10.0, 24],
        'three_quarter_burned': [22, 18, 22]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('sheltered_turnout', 'Sheltered turnout', 'Heat damage overlays', 'Charred debris', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['sheltered_turnout.png', 'sheltered_turnout_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'canopy_close.png', 'bench_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Sheltered turnout complete and verified!")
