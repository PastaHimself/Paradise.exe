import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Catacombs: Wall sconce
# Wrought iron crypt wall bracket holding a tallow church candle with bobeche drip pan, socket cup, and flame

# 1. Wall mount backplate & forged rivets (Z: 6.0 to 7.0 against wall plane)
c('backplate', [-1.5, 4.0, 6.0], [1.5, 14.0, 7.0], 'iron_plate')
c('bolt_top', [-0.5, 12.5, 5.7], [0.5, 13.5, 6.0], 'iron_plate')
c('bolt_bottom', [-0.5, 4.5, 5.7], [0.5, 5.5, 6.0], 'iron_plate')

# 2. Horizontal cantilever arm extending forward from wall plate (Z: -0.5 to 6.0, Y: 8.5 to 10.0)
c('arm', [-0.8, 8.5, -0.5], [0.8, 10.0, 6.0], 'iron_fixture')

# 3. Underneath structural support diagonal strut (Y: 5.5 to 8.5)
c('strut_rear', [-0.6, 5.5, 4.5], [0.6, 7.0, 6.0], 'iron_fixture')
c('strut_mid', [-0.6, 7.0, 2.5], [0.6, 8.5, 4.5], 'iron_fixture')
c('strut_front', [-0.6, 7.5, 0.5], [0.6, 8.5, 2.5], 'iron_fixture')

# 4. Front terminal collar / socket mount (Z: -2.5 to -0.5, Y: 8.0 to 10.5)
c('collar', [-1.2, 8.0, -2.5], [1.2, 10.5, -0.5], 'iron_fixture')

# 5. Drip pan / bobeche saucer (Y: 10.5 to 11.8, centered at X=0, Z=-1.5)
c('pan_base', [-3.0, 10.5, -4.5], [3.0, 11.2, 1.5], 'iron_fixture')
c('pan_rim_n', [-3.0, 11.2, -4.5], [3.0, 11.8, -4.0], 'iron_fixture')
c('pan_rim_s', [-3.0, 11.2, 1.0], [3.0, 11.8, 1.5], 'iron_fixture')
c('pan_rim_w', [-3.0, 11.2, -4.0], [-2.5, 11.8, 1.0], 'iron_fixture')
c('pan_rim_e', [2.5, 11.2, -4.0], [3.0, 11.8, 1.0], 'iron_fixture')

# 6. Sconce socket cup (Y: 11.2 to 13.5)
c('socket_cup', [-1.5, 11.2, -3.0], [1.5, 13.5, 0.0], 'iron_fixture')

# 7. Candle shaft, charred wick, and flame core (Y: 13.5 to 23.5)
c('candle_shaft', [-1.0, 13.5, -2.5], [1.0, 20.5, -0.5], 'candle_wax')
c('candle_wick', [-0.3, 20.5, -1.8], [0.3, 21.5, -1.2], 'wick_char')
c('candle_flame', [-0.7, 21.5, -2.2], [0.7, 23.5, -0.8], 'candle_flame')

# 8. Melted tallow wax drips
c('drip_cup', [-1.8, 11.5, -1.8], [-1.5, 13.0, -1.2], 'wax_drips')
c('drip_arm', [-0.5, 10.0, 1.5], [0.5, 10.6, 2.5], 'wax_drips')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'iron_fixture': (0, 0, 'cauldron_side.png', 16, 16),
    'iron_plate': (16, 0, 'polished_blackstone.png', 16, 16),
    'candle_wax': (32, 0, 'sandstone_smooth.png', 16, 16),
    'candle_flame': (48, 0, 'glowstone.png', 16, 16),
    'wax_drips': (0, 16, 'calcite.png', 16, 16),
    'wick_char': (16, 16, 'coal_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/medieval-wrought-iron-wall-sconce-torch-candle, https://www.alamy.com/stock-photo/gothic-iron-wall-sconce.html',
    'used': 'ancient subterranean catacombs wrought iron wall sconce fixture mounted to crypt stone wall with forged rivet backplate, cantilever bracket arm, diagonal support strut, bobeche drip saucer, candle socket cup, taper candle, and flame core',
    'limitations': [
        'modular 19-unit tall wrought iron wall sconce fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original cauldron_side, polished_blackstone, sandstone_smooth, glowstone, calcite, coal_block pixels unchanged; lit and extinguished variants'
    ]
}

D = build('wall_sconce', cs, a, regions, plan, area='catacombs')

checker(D, [0, 14.0, 0], [20, 22, 20])
views(D, [0, 14.0, 0], {
    'front': [0, 14.0, 18],
    'three_quarter': [16, 16, 16],
    'back': [-16, 16, -16],
    'gameplay_scale': [24, 20, 24],
    'socket_close': [0, 12.0, 6.0],
    'flame_close': [0, 21.0, 6.0]
})

# Create extinguished variant texture and views (flame replaced with snuffed coal stub)
im_ext = Image.open(D/'wall_sconce.png').convert('RGBA')
im_ext.paste(Image.open(S/'coal_block.png').convert('RGBA'), (48, 0))
im_ext.save(D/'wall_sconce_extinguished.png')
(D/'wall_sconce_lit.png').write_bytes((D/'wall_sconce.png').read_bytes())

call('create_texture', {'name': 'wall_sconce_extinguished', 'data': str(D/'wall_sconce_extinguished.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'wall_sconce_extinguished'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 14.0, 0], {
        'front_extinguished': [0, 14.0, 18],
        'three_quarter_extinguished': [16, 16, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('wall_sconce', 'Wall sconce', 'Iron lamp cage', 'Rubble pile', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['lit', 'extinguished'],
    'textures': ['wall_sconce.png', 'wall_sconce_lit.png', 'wall_sconce_extinguished.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'socket_close.png', 'flame_close.png', 'front_extinguished.png', 'three_quarter_extinguished.png']
}, indent=2))

print("Catacombs Wall sconce complete and verified with 100% full coverage!")
