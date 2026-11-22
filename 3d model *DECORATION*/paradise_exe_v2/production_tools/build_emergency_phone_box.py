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

# 1. Concrete Base Footing & Anchor Baseplate
c('footing_base', [-3.0, 0.0, -2.5], [3.0, 1.8, 2.5], 'concrete_base', off=['down'])
c('baseplate', [-2.5, 1.8, -2.0], [2.5, 2.3, 2.0], 'structural_steel', off=['down'])

# 2. Steel Column Mast (Y: 2.3 to 10.0)
c('column_mast', [-1.2, 2.3, -1.2], [1.2, 10.0, 1.2], 'galvanized_steel', off=['down'])

# 3. Main Phone Housing (Y: 10.0 to 17.5)
c('housing_body', [-2.8, 10.0, -2.2], [2.8, 17.5, 1.2], 'phone_orange', off=['down'])

# Recessed Intercom Cavity (Z: 1.2 to 2.5)
c('baffle_left', [-2.8, 10.5, 1.2], [-2.0, 17.0, 2.5], 'phone_orange', off=['north'])
c('baffle_right', [2.0, 10.5, 1.2], [2.8, 17.0, 2.5], 'phone_orange', off=['north'])
c('shelf_bottom', [-2.0, 10.5, 1.2], [2.0, 11.2, 2.5], 'phone_orange', off=['north', 'west', 'east'])
c('canopy_top', [-2.8, 17.0, 1.2], [2.8, 17.5, 2.5], 'phone_orange', off=['north', 'down'])

# 4. Phone Interface Components (inside the recess)
c('intercom_grille', [-1.2, 14.0, 1.2], [1.2, 16.0, 1.5], 'dark_metal', off=['north'])
c('sos_button', [-0.6, 12.0, 1.2], [0.6, 13.2, 1.8], 'button_red', off=['north'])

# 5. Top SOS Badge Panel (Y: 17.5 to 19.5)
c('sos_badge_panel', [-2.2, 17.5, -1.8], [2.2, 19.5, 1.8], 'sos_blue', off=['down'])

# 6. Solar Panel Riser & Collector (Y: 19.5 to 22.8)
c('solar_riser', [-0.6, 19.5, -0.6], [0.6, 21.6, 0.6], 'structural_steel', off=['down'])
c('solar_panel', [-3.0, 21.6, -2.5], [3.0, 22.4, 2.5], 'solar_cell', off=['down'])

# 7. Blue Flashing Emergency Strobe Beacon (Y: 22.4 to 24.0)
c('strobe_beacon', [-0.8, 22.4, -0.8], [0.8, 24.0, 0.8], 'strobe_blue', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'galvanized_steel': (32, 0, 'iron_block.png', 16, 16),
    'phone_orange': (48, 0, 'concrete_orange.png', 16, 16),
    'dark_metal': (0, 16, 'cauldron_side.png', 16, 16),
    'button_red': (16, 16, 'redstone_block.png', 16, 16),
    'sos_blue': (32, 16, 'concrete_blue.png', 16, 16),
    'solar_cell': (48, 16, 'coal_block.png', 16, 16),
    'strobe_blue': (0, 32, 'sea_lantern.png', 16, 16)
}

plan = {
    'reference': 'https://www.istockphoto.com/search/2/image?phrase=orange+highway+emergency+telephone+pillar, https://www.alamy.com/stock-photo/roadside-sos-assistance-call-box.html',
    'used': 'freeway roadside emergency SOS phone call box pillar with cast concrete footing, structural steel anchor baseplate, galvanized steel mounting stanchion, high-visibility orange enclosure body with recessed speakerphone cavity and wind baffles, red emergency pushbutton, intercom grille, blue SOS identifier placard, overhead solar photovoltaic panel, and blue high-intensity flashing emergency strobe beacon',
    'limitations': [
        'modular 24-unit high roadside SOS emergency pillar fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, iron_block, concrete_orange, cauldron_side, redstone_block, concrete_blue, coal_block, sea_lantern pixels unchanged; normal and scorched variants'
    ]
}

D = build('emergency_phone_box', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 12.0, 0.0], [20, 16, 20])
views(D, [0, 12.0, 0.0], {
    'front': [0, 12.0, 20],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [24, 22, 24],
    'interface_close': [0, 14.0, 8.0],
    'beacon_close': [0, 22.0, 8.0]
})

# Create scorched / burned variant texture and views
im_burned = Image.open(D/'emergency_phone_box.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (16, 16))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (32, 16))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (48, 16))
im_burned.paste(Image.open(S/'quartz_block_side.png').convert('RGBA'), (0, 32))
im_burned.save(D/'emergency_phone_box_burned.png')
(D/'emergency_phone_box_normal.png').write_bytes((D/'emergency_phone_box.png').read_bytes())

call('create_texture', {'name': 'emergency_phone_box_burned', 'data': str(D/'emergency_phone_box_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'emergency_phone_box_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 12.0, 0.0], {
        'front_burned': [0, 12.0, 20],
        'three_quarter_burned': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('emergency_phone_box', 'Emergency phone box', 'Maintenance gate', 'Hazard-striped service door', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'burned'],
    'textures': ['emergency_phone_box.png', 'emergency_phone_box_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'interface_close.png', 'beacon_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Emergency phone box complete and verified!")
