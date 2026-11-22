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

# 1. Lower Door Outer Skin (stamped curved exterior panel)
c('outer_skin_bot', [-6.5, 0.0, 0.0], [6.5, 4.0, 0.8], 'painted_metal', off=['up', 'north', 'down'])
c('outer_skin_top', [-6.5, 4.0, 0.0], [6.5, 7.0, 1.0], 'painted_metal', off=['down', 'north'])

# 2. Lower Door Inner Structure / Trim Card
c('inner_card', [-6.5, 0.0, -0.8], [6.5, 7.0, 0.0], 'interior_trim', off=['up', 'south', 'down'])
c('inner_armrest', [-2.0, 3.0, -1.2], [3.0, 4.0, -0.8], 'interior_trim', off=['east', 'west', 'south'])

# 3. Exterior Door Handle
c('handle_bar', [2.2, 5.2, 1.0], [4.8, 5.8, 1.3], 'chrome_hardware', off=['north'])

# 4. Window Frame / Pillars
c('sill_weatherstrip', [-6.5, 7.0, -0.4], [6.5, 7.3, 0.4], 'rubber_seal', off=['down'])
c('frame_front', [-6.5, 7.3, -0.4], [-5.5, 13.0, 0.4], 'painted_metal', off=['down', 'east'])
c('frame_rear', [5.5, 7.3, -0.4], [6.5, 13.0, 0.4], 'painted_metal', off=['down', 'west'])
c('frame_top', [-5.5, 12.2, -0.4], [5.5, 13.0, 0.4], 'painted_metal', off=['west', 'east'])

# 5. Shattered Glass Remnants in lower window track
c('glass_shards', [-5.5, 7.3, -0.1], [5.5, 7.8, 0.1], 'shattered_glass', off=['down'])

# 6. Hinges (Front edge X: -7.0 to -6.5)
c('hinge_upper', [-7.0, 5.0, -0.4], [-6.5, 6.2, 0.4], 'iron_hardware', off=['east'])
c('hinge_pin_upper', [-7.3, 5.3, -0.2], [-7.0, 5.9, 0.2], 'iron_hardware', off=['east'])
c('hinge_lower', [-7.0, 1.0, -0.4], [-6.5, 2.2, 0.4], 'iron_hardware', off=['east'])
c('hinge_pin_lower', [-7.3, 1.3, -0.2], [-7.0, 1.9, 0.2], 'iron_hardware', off=['east'])

# 7. Latch Mechanism (Rear edge X: 6.5 to 7.0)
c('latch_catch', [6.5, 4.2, -0.4], [7.0, 5.2, 0.4], 'iron_hardware', off=['west'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'painted_metal': (0, 0, 'concrete_gray.png', 16, 16),
    'interior_trim': (16, 0, 'blackstone_top.png', 16, 16),
    'rubber_seal': (32, 0, 'coal_block.png', 16, 16),
    'chrome_hardware': (48, 0, 'iron_block.png', 16, 16),
    'iron_hardware': (0, 16, 'raw_iron_block.png', 16, 16),
    'shattered_glass': (16, 16, 'glass.png', 16, 16)
}

plan = {
    'reference': 'https://www.istockphoto.com/search/2/image?phrase=damaged+vehicle+door+accident+wreckage, https://www.dreamstime.com/photos-images/car-crash-wreckage-highway-debris.html',
    'used': 'freeway detached automotive vehicle door with stamped exterior sheet metal skin, beltline contour, recessed interior door card with molded armrest, chrome exterior pull handle, window frame pillars and header, shattered safety glass residue in window run, upper and lower hinge mounts with sheared hinge pins, and latch striker assembly',
    'limitations': [
        'modular detached door prop fitting within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_gray, blackstone_top, coal_block, iron_block, raw_iron_block, glass pixels unchanged; static damage geometry; normal and burned variants'
    ]
}

D = build('loose_vehicle_door', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 6.5, 0], [18, 16, 18])
views(D, [0, 6.5, 0], {
    'front': [0, 6.5, 18],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [24, 20, 24],
    'interior_card': [0, 6.5, -14],
    'hinge_close': [-7.0, 5.5, 6.0]
})

# Create burned / scorched variant texture and views
im_burned = Image.open(D/'loose_vehicle_door.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'glass.png').convert('RGBA'), (16, 16))
im_burned.save(D/'loose_vehicle_door_burned.png')
(D/'loose_vehicle_door_normal.png').write_bytes((D/'loose_vehicle_door.png').read_bytes())

call('create_texture', {'name': 'loose_vehicle_door_burned', 'data': str(D/'loose_vehicle_door_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'loose_vehicle_door_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 6.5, 0], {
        'front_burned': [0, 6.5, 18],
        'three_quarter_burned': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('loose_vehicle_door', 'Loose vehicle door', 'Scrap pile', 'Streetlamp', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['loose_vehicle_door.png', 'loose_vehicle_door_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'interior_card.png', 'hinge_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Loose vehicle door complete and verified!")
