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

# 1. Foundation Stub & Sheared Baseplate
# Concrete base footing remains at X: [-13.0, -9.0]
c('footing_stub', [-13.0, 0.0, -2.0], [-9.0, 1.8, 2.0], 'concrete_base', off=['down'])

# Sheared anchor baseplate warped on footing
c('sheared_baseplate', [-12.6, 1.8, -1.6], [-9.4, 2.3, 1.6], 'structural_steel', off=['down'])

# 4 Bent / Sheared Anchor Studs
c('stud_nw', [-12.3, 2.3, -1.3], [-11.9, 2.8, -0.9], 'hardware', off=['down'])
c('stud_ne', [-10.1, 2.3, -1.3], [-9.7, 2.8, -0.9], 'hardware', off=['down'])
c('stud_sw', [-12.3, 2.3, 0.9], [-11.9, 2.8, 1.3], 'hardware', off=['down'])
c('stud_se', [-10.1, 2.3, 0.9], [-9.7, 2.8, 1.3], 'hardware', off=['down'])

# Severed base wiring conduit stub in center of baseplate
c('conduit_stub', [-11.3, 2.3, -0.3], [-10.7, 2.7, 0.3], 'copper_wire', off=['down'])

# 2. Fallen Lower Mast Pole (lying on asphalt, sheared from base)
c('fallen_pole_lower', [-8.5, 0.0, -1.0], [2.0, 2.0, 1.0], 'galvanized_steel', off=['down', 'east'])

# Sheared torn base rim collar at detached end
c('torn_pole_base', [-8.8, 0.0, -1.1], [-8.5, 2.1, 1.1], 'structural_steel', off=['east', 'down'])

# Handhole inspection cover popped open / buckled
c('open_handhole_door', [-5.5, 2.0, -0.6], [-3.0, 2.3, 0.6], 'structural_steel', off=['down'])

# 3. Impact Dent / Buckle V-Crease in mid-mast
c('dent_crease', [2.0, 0.0, -0.9], [4.0, 1.6, 0.9], 'galvanized_steel', off=['down', 'west', 'east'])

# 4. Upper Tapered Mast Pole (deflected angle along +X)
c('fallen_pole_upper', [4.0, 0.0, 0.0], [11.5, 1.6, 1.6], 'galvanized_steel', off=['down', 'west'])

# Slipfitter pole collar ring
c('fallen_collar', [11.5, 0.0, 0.1], [12.2, 1.7, 1.7], 'structural_steel', off=['west', 'down'])

# 5. Crumpled Cantilever Mast Arm
c('crumpled_arm', [12.2, 0.0, 0.5], [14.0, 1.2, 3.2], 'galvanized_steel', off=['west', 'down'])

# 6. Smashed Cobra Head Luminaire Fixture (impact crushed against road)
c('smashed_housing', [12.8, 0.0, 3.2], [14.4, 1.0, 5.5], 'luminaire_housing', off=['north', 'down', 'west'])

# Shattered glass refractor shards on road beside housing
c('scattered_lens_shards', [11.0, 0.0, 3.5], [12.8, 0.2, 5.8], 'shattered_glass', off=['down', 'east'])

# Photocell knocked off / crushed
c('crushed_photocell', [13.2, 1.0, 4.0], [13.8, 1.3, 4.6], 'structural_steel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'hardware': (32, 0, 'raw_iron_block.png', 16, 16),
    'galvanized_steel': (48, 0, 'iron_block.png', 16, 16),
    'copper_wire': (0, 16, 'copper_block.png', 16, 16),
    'luminaire_housing': (16, 16, 'concrete_gray.png', 16, 16),
    'shattered_glass': (32, 16, 'glass.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/car-crashed-light-pole, https://www.alamy.com/stock-photo/car-crashed-into-lamp-post.html',
    'used': 'freeway fallen and sheared cobra head streetlamp knocked flat across the roadway by severe vehicle impact, featuring sheared concrete foundation footing with warped anchor plate, bent sheared anchor studs, severed copper wiring conduit stub, severed lower mast pole with torn base rim and popped open handhole inspection cover, vehicle impact V-crease buckle in mid-mast, deflected upper mast pole, crumpled cantilever davit arm, road-crushed cobra head housing, crushed photocell, and shattered glass refractor lens fragments on asphalt',
    'limitations': [
        'modular 27.4-unit wide fallen streetlamp wreckage fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, raw_iron_block, iron_block, copper_block, concrete_gray, glass pixels unchanged; normal and scorched variants'
    ]
}

D = build('fallen_streetlamp', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 1.2, 1.5], [20, 16, 20])
views(D, [0, 1.2, 1.5], {
    'front': [0, 1.2, 20],
    'three_quarter': [20, 18, 20],
    'back': [-20, 18, -20],
    'gameplay_scale': [26, 24, 26],
    'sheared_base_close': [-11.0, 1.5, 6.0],
    'smashed_head_close': [13.0, 1.2, 10.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'fallen_streetlamp.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'copper_block.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (16, 16))
im_burned.paste(Image.open(S/'glass.png').convert('RGBA'), (32, 16))
im_burned.save(D/'fallen_streetlamp_burned.png')
(D/'fallen_streetlamp_normal.png').write_bytes((D/'fallen_streetlamp.png').read_bytes())

call('create_texture', {'name': 'fallen_streetlamp_burned', 'data': str(D/'fallen_streetlamp_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'fallen_streetlamp_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 1.2, 1.5], {
        'front_burned': [0, 1.2, 20],
        'three_quarter_burned': [20, 18, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('fallen_streetlamp', 'Fallen streetlamp', 'Sign gantry', 'Drain grate', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['fallen_streetlamp.png', 'fallen_streetlamp_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'sheared_base_close.png', 'smashed_head_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Fallen streetlamp complete and verified!")
