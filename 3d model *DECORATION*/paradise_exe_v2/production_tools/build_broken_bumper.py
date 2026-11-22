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

# 1. Main Front Fascia
c('center_nose', [-5.0, 0.0, 1.2], [5.0, 3.8, 2.2], 'plastic', off=['down'])
c('left_cheek',  [-9.5, 0.0, -1.2], [-5.0, 3.8, 1.2], 'plastic', off=['down', 'east'])
c('right_cheek', [5.0, 0.0, -1.2], [9.5, 3.8, 1.2], 'plastic', off=['down', 'west'])

# 2. Lower Chin Splitter
c('chin_lip', [-7.0, 0.0, 2.2], [7.0, 0.8, 3.0], 'scuffed_plastic', off=['down', 'north'])

# 3. Lower Air Dam Grille
c('lower_grille', [-4.0, 0.8, 2.2], [4.0, 2.0, 2.5], 'dark_grille', off=['down', 'north'])

# 4. Fog Light Pockets
c('fog_pocket_l', [-7.5, 1.0, 1.2], [-5.5, 2.4, 1.6], 'scuffed_plastic', off=['north'])
c('fog_pocket_r', [5.5, 1.0, 1.2], [7.5, 2.4, 1.6], 'scuffed_plastic', off=['north'])

# 5. Mounting Tabs & Metal Clips
c('mount_tab_l', [-6.5, 3.8, 0.0], [-5.5, 4.5, 0.8], 'plastic', off=['down', 'up'])
c('mount_tab_r', [5.5, 3.8, 0.0], [6.5, 4.5, 0.8], 'plastic', off=['down', 'up'])

c('clip_l', [-6.2, 4.5, 0.2], [-5.8, 5.0, 0.6], 'metal_clip', off=['down'])
c('clip_r', [5.8, 4.5, 0.2], [6.2, 5.0, 0.6], 'metal_clip', off=['down'])

# 6. Crack / Fracture Scar
c('crack_scar', [-5.4, 0.8, 2.2], [-4.8, 3.8, 2.4], 'scuffed_plastic', off=['down', 'north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'plastic': (0, 0, 'concrete_gray.png', 16, 16),
    'scuffed_plastic': (16, 0, 'blackstone_top.png', 16, 16),
    'dark_grille': (32, 0, 'cauldron_side.png', 16, 16),
    'metal_clip': (48, 0, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/road-debris-car-bumper, https://www.alamy.com/stock-photo/damaged-car-bumper-roadside-debris.html',
    'used': 'freeway broken automotive bumper with front fascia nose, swept aerodynamic cheeks, chin splitter lip, lower air dam grille, recessed fog light pockets, sheared mounting tabs, deformed sheet metal clips, and impact fracture crack scar',
    'limitations': [
        'modular 19-unit wide bumper fitting within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_gray, blackstone_top, cauldron_side, iron_block pixels unchanged; static damage geometry; normal and scorched variants'
    ]
}

D = build('broken_bumper', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 2.5, 1.0], [16, 16, 16])
views(D, [0, 2.5, 1.0], {
    'front': [0, 2.5, 16],
    'three_quarter': [16, 12, 16],
    'back': [-16, 12, -16],
    'gameplay_scale': [22, 18, 22],
    'fracture_close': [-5.0, 2.5, 8.0]
})

# Create burned / scorched variant texture and views
im_burned = Image.open(D/'broken_bumper.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (48, 0))
im_burned.save(D/'broken_bumper_burned.png')
(D/'broken_bumper_normal.png').write_bytes((D/'broken_bumper.png').read_bytes())

call('create_texture', {'name': 'broken_bumper_burned', 'data': str(D/'broken_bumper_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'broken_bumper_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.5, 1.0], {
        'front_burned': [0, 2.5, 16],
        'three_quarter_burned': [16, 12, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('broken_bumper', 'Broken bumper', 'Loose vehicle door', 'Scrap pile', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['broken_bumper.png', 'broken_bumper_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'fracture_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Broken bumper complete and verified!")
