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

# 1. Base Flattened Sheet Metal Plate (lying flat on ground)
c('base_plate_main', [-7.0, 0.0, -6.0], [5.0, 0.4, 4.0], 'twisted_sheet', off=['down'])
c('plate_fold_lip', [-7.0, 0.4, 2.5], [-4.0, 1.2, 4.0], 'twisted_sheet', off=['south', 'west', 'down'])

# 2. Sheared Exhaust Pipe / Muffler Segment (angled along X)
c('exhaust_pipe', [-5.0, 0.4, -4.5], [3.5, 1.8, -3.1], 'scorched_metal', off=['down', 'east'])
c('pipe_flange', [3.5, 0.4, -4.8], [4.5, 2.0, -2.8], 'raw_metal', off=['west', 'down'])

# 3. Bent U-Channel Structural Steel Bracket (angled across pile)
c('uchannel_web', [-2.0, 0.4, -3.0], [-0.6, 1.0, 3.0], 'structural_steel', off=['down'])
c('uchannel_flange_l', [-2.0, 1.0, -3.0], [-1.6, 2.6, 3.0], 'structural_steel', off=['down'])
c('uchannel_flange_r', [-1.0, 1.0, -3.0], [-0.6, 2.6, 3.0], 'structural_steel', off=['down'])

# 4. Crumpled Body Panel Wedge (leaning across the U-channel)
c('crumpled_panel_body', [0.5, 0.4, -1.5], [4.5, 1.6, 1.5], 'twisted_sheet', off=['down'])
c('crumpled_panel_crease', [1.5, 1.6, -1.2], [4.5, 3.4, 1.2], 'twisted_sheet', off=['down'])

# 5. Brake Rotor / Disc Hub (leaning near edge)
c('rotor_disc', [-6.0, 0.4, -1.5], [-3.0, 3.2, -0.7], 'raw_metal', off=['down'])
c('rotor_hub', [-5.0, 1.3, -0.7], [-4.0, 2.3, -0.3], 'structural_steel', off=['north'])

# 6. Sheared Suspension Coil / Spring Segment
c('coil_ring_1', [2.0, 0.4, 2.0], [4.5, 1.2, 4.5], 'structural_steel', off=['down'])
c('coil_ring_2', [2.2, 1.2, 2.2], [4.3, 2.0, 4.3], 'structural_steel', off=['down'])

# 7. Shattered Safety Glass Cluster on Asphalt (outside base plate)
c('glass_patch_1', [-6.5, 0.0, 4.2], [-3.0, 0.2, 6.5], 'shattered_glass', off=['down'])
c('glass_patch_2', [5.2, 0.0, -5.5], [7.3, 0.2, -2.5], 'shattered_glass', off=['down'])

# 8. Stripped Wire Harness / Rubber Cable
c('cable_segment_1', [-4.0, 0.4, -5.5], [1.0, 0.7, -4.8], 'rubber_cable', off=['down'])
c('cable_segment_2', [5.2, 0.0, -2.0], [7.5, 0.3, -1.2], 'rubber_cable', off=['down'])

# 9. Sheared Bolts and Hardware Clips
c('bolt_cluster_1', [-3.5, 0.4, 0.5], [-2.5, 0.9, 1.5], 'raw_metal', off=['down'])
c('bolt_cluster_2', [-1.5, 0.4, 3.2], [-0.7, 0.9, 4.0], 'raw_metal', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'twisted_sheet': (0, 0, 'iron_block.png', 16, 16),
    'scorched_metal': (16, 0, 'blackstone_top.png', 16, 16),
    'raw_metal': (32, 0, 'raw_iron_block.png', 16, 16),
    'structural_steel': (48, 0, 'netherite_block.png', 16, 16),
    'shattered_glass': (0, 16, 'glass.png', 16, 16),
    'rubber_cable': (16, 16, 'coal_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/multi-vehicle-car-accident-highway-debris, https://www.istockphoto.com/search/2/image?phrase=road+debris+car+accident',
    'used': 'freeway roadside crash debris scrap pile with flattened buckled sheet metal floor panel, sheared exhaust pipe with muffler flange, bent structural U-channel steel frame bracket, crumpled body panel wedge, brake rotor disc and hub, sheared suspension coil spring rings, scattered safety glass clusters, stripped rubber wiring cable harness, and sheared hardware bolt clusters',
    'limitations': [
        'modular 15-unit wide roadside debris pile fitting within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, blackstone_top, raw_iron_block, netherite_block, glass, coal_block pixels unchanged; static damage geometry; normal and scorched variants'
    ]
}

D = build('scrap_pile', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 1.5, 0], [18, 16, 18])
views(D, [0, 1.5, 0], {
    'front': [0, 1.5, 18],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [24, 22, 24],
    'exhaust_close': [0, 1.5, -12],
    'rotor_close': [-5.0, 1.5, -4.0]
})

# Create burned / scorched variant texture and views
im_burned = Image.open(D/'scrap_pile.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'glass.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (16, 16))
im_burned.save(D/'scrap_pile_burned.png')
(D/'scrap_pile_normal.png').write_bytes((D/'scrap_pile.png').read_bytes())

call('create_texture', {'name': 'scrap_pile_burned', 'data': str(D/'scrap_pile_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'scrap_pile_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 1.5, 0], {
        'front_burned': [0, 1.5, 18],
        'three_quarter_burned': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('scrap_pile', 'Scrap pile', 'Streetlamp', 'Fallen streetlamp', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['scrap_pile.png', 'scrap_pile_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'exhaust_close.png', 'rotor_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Scrap pile complete and verified!")
