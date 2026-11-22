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

# 1. Concrete Base Footing
c('footing_base', [-2.0, 0.0, -2.0], [2.0, 2.0, 2.0], 'concrete_base', off=['down'])

# 2. Steel Anchor Baseplate
c('baseplate', [-1.6, 2.0, -1.6], [1.6, 2.6, 1.6], 'structural_steel', off=['down'])

# 4 Corner Anchor Bolt Nuts
c('bolt_nw', [-1.4, 2.6, -1.4], [-1.0, 3.0, -1.0], 'hardware', off=['down'])
c('bolt_ne', [1.0, 2.6, -1.4], [1.4, 3.0, -1.0], 'hardware', off=['down'])
c('bolt_sw', [-1.4, 2.6, 1.0], [-1.0, 3.0, 1.4], 'hardware', off=['down'])
c('bolt_se', [1.0, 2.6, 1.0], [1.4, 3.0, 1.4], 'hardware', off=['down'])

# 3. Lower Mast Pole (Y: 2.6 to 15.0)
c('pole_lower', [-1.0, 2.6, -1.0], [1.0, 15.0, 1.0], 'galvanized_steel', off=['down'])

# Handhole cover plate on lower pole
c('handhole_cover', [-1.15, 4.0, -0.5], [-1.0, 6.5, 0.5], 'structural_steel', off=['east'])

# 4. Upper Tapered Mast Pole (Y: 15.0 to 24.6)
c('pole_upper', [-0.8, 15.0, -0.8], [0.8, 24.6, 0.8], 'galvanized_steel', off=['down'])

# Pole cap / tenon junction collar (Y: 24.6 to 25.4)
c('pole_collar', [-0.9, 24.6, -0.9], [0.9, 25.4, 0.9], 'structural_steel', off=['down'])

# 5. Cantilever Cobra Head Mast Arm (Sweeping forward along +Z towards roadway)
c('arm_step_1', [-0.6, 25.4, 0.0], [0.6, 27.2, 3.2], 'galvanized_steel', off=['down', 'north'])
c('arm_step_2', [-0.5, 27.0, 3.2], [0.5, 28.5, 7.0], 'galvanized_steel', off=['down', 'north'])
c('arm_step_3', [-0.4, 28.0, 7.0], [0.4, 28.8, 10.5], 'galvanized_steel', off=['down', 'north'])

# 6. Cobra Head Luminaire Fixture
c('tenon_mount', [-0.6, 28.1, 10.5], [0.6, 29.1, 11.5], 'structural_steel', off=['north'])
c('cobra_housing', [-1.2, 28.0, 11.5], [1.2, 29.3, 14.2], 'luminaire_housing', off=['north'])
c('refractor_lens', [-1.0, 27.5, 12.0], [1.0, 28.0, 13.8], 'luminaire_lens', off=['up'])
c('photocell', [-0.3, 29.3, 12.0], [0.3, 29.7, 12.6], 'structural_steel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'concrete_base': (0, 0, 'stone_slab_top.png', 16, 16),
    'structural_steel': (16, 0, 'netherite_block.png', 16, 16),
    'hardware': (32, 0, 'raw_iron_block.png', 16, 16),
    'galvanized_steel': (48, 0, 'iron_block.png', 16, 16),
    'luminaire_housing': (0, 16, 'concrete_gray.png', 16, 16),
    'luminaire_lens': (16, 16, 'sea_lantern.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/highway-cobra-head-street-lamp, https://www.alamy.com/stock-photo/freeway-luminaire-galvanized-steel-pole.html',
    'used': 'freeway high-mast cobra head streetlamp with cast concrete footing pier, structural steel anchor baseplate with 4-corner bolt nuts, lower mast with electrical inspection handhole cover, tapered upper mast pole with slipfitter collar, sweeping cantilever davit mast arm reaching over traffic lanes, tenon mount, cast aluminum cobra head luminaire housing, prismatic refractor lens, and top photocell twist-lock sensor',
    'limitations': [
        'full-height 29.7-unit freeway streetlamp fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stone_slab_top, netherite_block, raw_iron_block, iron_block, concrete_gray, sea_lantern pixels unchanged; lit and unlit/burned variants'
    ]
}

D = build('streetlamp', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 15.0, 5.0], [24, 20, 24])
views(D, [0, 15.0, 5.0], {
    'front': [0, 15.0, 24],
    'three_quarter': [24, 22, 24],
    'back': [-24, 22, -24],
    'gameplay_scale': [30, 26, 30],
    'cobra_head_close': [0, 28.5, 18.0],
    'base_close': [0, 2.5, 8.0]
})

# Create unlit / burned variant texture and views
im_burned = Image.open(D/'streetlamp.png').convert('RGBA')
im_burned.paste(Image.open(S/'stone_slab_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (16, 0))
im_burned.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (32, 0))
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (48, 0))
im_burned.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (0, 16))
im_burned.paste(Image.open(S/'quartz_block_side.png').convert('RGBA'), (16, 16))
im_burned.save(D/'streetlamp_burned.png')
(D/'streetlamp_lit.png').write_bytes((D/'streetlamp.png').read_bytes())

call('create_texture', {'name': 'streetlamp_burned', 'data': str(D/'streetlamp_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'streetlamp_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 15.0, 5.0], {
        'front_burned': [0, 15.0, 24],
        'three_quarter_burned': [24, 22, 24]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('streetlamp', 'Streetlamp', 'Fallen streetlamp', 'Sign gantry', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['lit', 'burned_unlit'],
    'textures': ['streetlamp.png', 'streetlamp_burned.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'cobra_head_close.png', 'base_close.png', 'front_burned.png', 'three_quarter_burned.png']
}, indent=2))

print("Streetlamp complete and verified!")
