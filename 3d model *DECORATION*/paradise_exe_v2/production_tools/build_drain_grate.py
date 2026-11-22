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

# 1. Concrete Gutter Apron / Frame
c('apron_north', [-8.0, 0.0, 5.2], [8.0, 2.0, 8.0], 'concrete_gutter', off=['down'])
c('apron_south', [-8.0, 0.0, -8.0], [8.0, 2.0, -5.2], 'concrete_gutter', off=['down'])
c('apron_west', [-8.0, 0.0, -5.2], [-5.2, 2.0, 5.2], 'concrete_gutter', off=['down', 'north', 'south'])
c('apron_east', [5.2, 0.0, -5.2], [8.0, 2.0, 5.2], 'concrete_gutter', off=['down', 'north', 'south'])

# 2. Curb Rise Wall (North side curb edge)
c('curb_wall', [-8.0, 2.0, 6.2], [8.0, 5.0, 8.0], 'concrete_gutter', off=['down'])

# 3. Catch Basin Pit Bottom (Deep dark interior)
c('basin_pit_bottom', [-5.2, 0.0, -5.2], [5.2, 0.4, 5.2], 'dark_sump', off=['down', 'north', 'south', 'east', 'west'])

# 4. Cast Iron Grate Rim Frame (rests inside apron lip at Y: [1.4, 2.0])
c('grate_rim_n', [-5.2, 1.4, 4.4], [5.2, 2.0, 5.2], 'cast_iron', off=['down', 'south', 'west', 'east'])
c('grate_rim_s', [-5.2, 1.4, -5.2], [5.2, 2.0, -4.4], 'cast_iron', off=['down', 'north', 'west', 'east'])
c('grate_rim_w', [-5.2, 1.4, -4.4], [-4.4, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south', 'west'])
c('grate_rim_e', [4.4, 1.4, -4.4], [5.2, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south', 'east'])

# 5. Longitudinal Grate Bars (spanning Z: [-4.4, 4.4], Y: [1.4, 2.0])
c('grate_bar_1', [-3.6, 1.4, -4.4], [-2.8, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_2', [-1.8, 1.4, -4.4], [-1.0, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_3', [-0.4, 1.4, -4.4], [0.4, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_4', [1.0, 1.4, -4.4], [1.8, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_5', [2.8, 1.4, -4.4], [3.6, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])

# 6. Transverse Tie Bars (underneath longitudinal bars to reinforce, Y: [1.1, 1.4])
c('cross_tie_1', [-4.4, 1.1, -2.2], [4.4, 1.4, -1.6], 'cast_iron', off=['down'])
c('cross_tie_2', [-4.4, 1.1, 1.6], [4.4, 1.4, 2.2], 'cast_iron', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_gutter': (0, 0, 'stone_slab_top.png', 16, 16),
    'dark_sump': (16, 0, 'blackstone_top.png', 16, 16),
    'cast_iron': (32, 0, 'cauldron_side.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/roadside-storm-drain-grate, https://www.alamy.com/stock-photo/linear-cast-iron-storm-drain-grate-embedded-in-asphalt.html',
    'used': 'freeway roadway storm drain curb inlet with cast concrete gutter apron, raised curb back wall, recessed sewer sump basin pit, ductile cast iron perimeter frame rim, parallel longitudinal drainage vane bars, and transverse reinforcing tie-rod bars',
    'limitations': [
        'modular 16x16-unit roadway curb drainage inlet fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, blackstone_top, cauldron_side pixels unchanged; clean and scorched/clogged variants'
    ]
}

D = build('drain_grate', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 2.0, 0.0], [18, 16, 18])
views(D, [0, 2.0, 0.0], {
    'front': [0, 2.0, 18],
    'three_quarter': [16, 16, 16],
    'back': [-16, 16, -16],
    'gameplay_scale': [22, 20, 22],
    'grate_top_close': [0, 12.0, 1.0],
    'curb_close': [0, 4.0, 10.0]
})

# Create scorched / clogged variant texture and views
im_burned = Image.open(D/'drain_grate.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'coal_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (32, 0))
im_burned.save(D/'drain_grate_burned.png')
(D/'drain_grate_normal.png').write_bytes((D/'drain_grate.png').read_bytes())

call('create_texture', {'name': 'drain_grate_burned', 'data': str(D/'drain_grate_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'drain_grate_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.0, 0.0], {
        'front_burned': [0, 2.0, 18],
        'three_quarter_burned': [16, 16, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('drain_grate', 'Drain grate', 'Utility cabinet', 'Expansion joint', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['normal', 'scorched_clogged'],
    'textures': ['drain_grate.png', 'drain_grate_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'grate_top_close.png', 'curb_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Drain grate complete and verified!")
