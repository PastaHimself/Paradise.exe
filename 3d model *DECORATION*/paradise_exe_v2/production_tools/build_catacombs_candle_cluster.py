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

# Catacombs: Candle cluster
# Group of wax church candles of varying heights on a heavy iron saucer with tallow drips, wicks, and flames

# 1. Base Saucer / Dish (Y: 0.0 to 1.6)
c('saucer_base', [-7.0, 0.0, -7.0], [7.0, 0.8, 7.0], 'iron_saucer')
c('saucer_rim_north', [-7.0, 0.8, -7.0], [7.0, 1.6, -6.0], 'iron_saucer')
c('saucer_rim_south', [-7.0, 0.8, 6.0], [7.0, 1.6, 7.0], 'iron_saucer')
c('saucer_rim_west', [-7.0, 0.8, -6.0], [-6.0, 1.6, 6.0], 'iron_saucer')
c('saucer_rim_east', [6.0, 0.8, -6.0], [7.0, 1.6, 6.0], 'iron_saucer')

# Saucer wrought iron handles / lugs
c('saucer_lug_west', [-8.5, 0.4, -1.0], [-7.0, 1.2, 1.0], 'iron_saucer')
c('saucer_lug_east', [7.0, 0.4, -1.0], [8.5, 1.2, 1.0], 'iron_saucer')

# 2. Candle 1 (Tall center-rear altar taper candle: centered at X=0, Z=-1.5)
c('candle1_shaft', [-1.8, 0.8, -3.3], [1.8, 12.8, 0.3], 'candle_wax')
c('candle1_wick', [-0.4, 12.8, -1.9], [0.4, 14.0, -1.1], 'wick_char')
c('candle1_flame', [-0.8, 14.0, -2.3], [0.8, 16.0, -0.7], 'flame_lit')

# 3. Candle 2 (Medium left votive candle: centered at X=-3.8, Z=2.0)
c('candle2_shaft', [-5.3, 0.8, 0.5], [-2.3, 8.8, 3.5], 'candle_wax')
c('candle2_wick', [-4.2, 8.8, 1.6], [-3.4, 9.8, 2.4], 'wick_char')
c('candle2_flame', [-4.5, 9.8, 1.3], [-3.1, 11.4, 2.7], 'flame_lit')

# 4. Candle 3 (Short front-right burned-down pillar candle: centered at X=3.5, Z=2.2)
c('candle3_shaft', [1.8, 0.8, 0.5], [5.2, 5.2, 3.9], 'candle_wax')
c('candle3_wick', [3.1, 5.2, 1.8], [3.9, 6.2, 2.6], 'wick_char')
c('candle3_flame', [2.8, 6.2, 1.5], [4.2, 7.8, 2.9], 'flame_lit')

# 5. Candle 4 (Slender rear-right votive candle: centered at X=3.6, Z=-3.5)
c('candle4_shaft', [2.4, 0.8, -4.7], [4.8, 9.6, -2.3], 'candle_wax')
c('candle4_wick', [3.2, 9.6, -3.9], [4.0, 10.6, -3.1], 'wick_char')
c('candle4_flame', [2.9, 10.6, -4.2], [4.3, 12.2, -2.8], 'flame_lit')

# 6. Tallow Wax Melt Pools & Side Drips
c('melt_pool_tall', [-2.6, 0.8, -4.0], [-1.8, 1.6, -1.5], 'wax_drips')
c('melt_pool_front', [-0.5, 0.8, 1.0], [1.8, 1.4, 3.5], 'wax_drips')
c('candle1_drip', [1.8, 5.0, -2.5], [2.3, 9.0, -1.5], 'wax_drips')
c('candle2_drip', [-5.7, 3.0, 1.5], [-5.3, 6.5, 2.5], 'wax_drips')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'iron_saucer': (0, 0, 'cauldron_side.png', 16, 16),
    'candle_wax': (16, 0, 'sandstone_smooth.png', 16, 16),
    'wax_drips': (32, 0, 'calcite.png', 16, 16),
    'flame_lit': (48, 0, 'glowstone.png', 16, 16),
    'wick_char': (0, 16, 'polished_blackstone.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/church-candles-cluster-crypt, https://www.alamy.com/stock-photo/ancient-tallow-candles-in-crypt.html',
    'used': 'ancient subterranean catacombs church candle cluster resting on a rimmed heavy wrought iron saucer tray, featuring 4 beeswax taper and votive candles of staggered heights, pooled tallow melt mounds, side drips, charred wicks, and glowing flame cores',
    'limitations': [
        'modular 17-unit wide church candle cluster fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original cauldron_side, sandstone_smooth, calcite, glowstone, polished_blackstone pixels unchanged; lit and extinguished variants'
    ]
}

D = build('candle_cluster', cs, a, regions, plan, area='catacombs')

checker(D, [0, 8.0, 0], [20, 20, 20])
views(D, [0, 8.0, 0], {
    'front': [0, 8.0, 18],
    'three_quarter': [14, 14, 14],
    'back': [-14, 14, -14],
    'gameplay_scale': [22, 18, 22],
    'cluster_close': [0, 8.0, 10.0],
    'wicks_close': [0, 12.0, 8.0]
})

# Create extinguished variant texture and views (flame replaced with snuffed coal stub)
im_ext = Image.open(D/'candle_cluster.png').convert('RGBA')
im_ext.paste(Image.open(S/'coal_block.png').convert('RGBA'), (48, 0))
im_ext.save(D/'candle_cluster_extinguished.png')
(D/'candle_cluster_lit.png').write_bytes((D/'candle_cluster.png').read_bytes())

call('create_texture', {'name': 'candle_cluster_extinguished', 'data': str(D/'candle_cluster_extinguished.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'candle_cluster_extinguished'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_extinguished': [0, 8.0, 18],
        'three_quarter_extinguished': [14, 14, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('candle_cluster', 'Candle cluster', 'Wall sconce', 'Iron lamp cage', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['lit', 'extinguished'],
    'textures': ['candle_cluster.png', 'candle_cluster_lit.png', 'candle_cluster_extinguished.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'cluster_close.png', 'wicks_close.png', 'front_extinguished.png', 'three_quarter_extinguished.png']
}, indent=2))

print("Catacombs Candle cluster complete and verified with 100% full coverage!")
