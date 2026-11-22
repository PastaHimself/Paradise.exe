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

# Catacombs: Covered-route marker
# Freestanding carved stone waypoint pillar stele marking a hidden or covered subterranean passage with stepped pedestal, recessed waypoint emblem panel, molded capital, and pyramid canopy crest

# 1. Stepped ashlar pedestal base (Y: 0.0 to 3.5)
c('base_lower', [-6.0, 0.0, -6.0], [6.0, 2.0, 6.0], 'ashlar_stone')
c('base_upper', [-4.5, 2.0, -4.5], [4.5, 3.5, 4.5], 'cracked_stone')

# 2. Main pillar shaft (Y: 3.5 to 11.0)
c('shaft_main', [-3.0, 3.5, -3.0], [3.0, 11.0, 3.0], 'ashlar_stone')

# 3. North waypoint marker recess borders & carved waypoint emblem (Z: -3.5 to -3.0)
c('border_left', [-3.0, 6.0, -3.5], [-2.0, 10.0, -3.0], 'ashlar_stone')
c('border_right', [2.0, 6.0, -3.5], [3.0, 10.0, -3.0], 'ashlar_stone')
c('border_top', [-2.0, 9.2, -3.5], [2.0, 10.0, -3.0], 'ashlar_stone')
c('marker_relief', [-1.2, 6.8, -3.4], [1.2, 9.2, -3.0], 'carved_marker')

# 4. Molded pillar capital (Y: 11.0 to 13.5)
c('capital_bed', [-3.8, 11.0, -3.8], [3.8, 12.2, 3.8], 'cracked_stone')
c('capital_abacus', [-4.5, 12.2, -4.5], [4.5, 13.5, 4.5], 'ashlar_stone')

# 5. Pyramid canopy crest & finial acroterion tip (Y: 13.5 to 18.0)
c('canopy_lower', [-3.5, 13.5, -3.5], [3.5, 15.0, 3.5], 'ashlar_stone')
c('canopy_apex', [-2.0, 15.0, -2.0], [2.0, 16.5, 2.0], 'cracked_stone')
c('finial_tip', [-0.8, 16.5, -0.8], [0.8, 18.0, 0.8], 'ashlar_stone')

# 6. Weathering debris resting on pedestal
c('chip_corner', [4.5, 2.0, 4.5], [5.8, 3.2, 5.8], 'cracked_stone')
c('fragment_stone', [-5.8, 2.0, -5.8], [-4.5, 3.0, -4.5], 'lime_mortar')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_marker': (32, 0, 'lodestone_top.png', 16, 16),
    'lime_mortar': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/stone-waypoint-marker-crypt-catacombs, https://www.alamy.com/stock-photo/ancient-stone-route-marker-pillar.html',
    'used': 'ancient subterranean catacombs covered-route marker monumental stone waypoint pillar stele with stepped ashlar base, carved navigational emblem recess, molded capital, pyramid canopy crest, and weathered debris',
    'limitations': [
        'modular 18-unit tall waypoint marker stele fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, lodestone_top, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('covered_route_marker', cs, a, regions, plan, area='catacombs')

checker(D, [0, 9.0, 0], [20, 22, 20])
views(D, [0, 9.0, 0], {
    'front': [0, 9.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 20, 24],
    'marker_close': [0, 8.0, 8.0],
    'canopy_close': [0, 15.0, 8.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'covered_route_marker.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'covered_route_marker_damp.png')
(D/'covered_route_marker_dry.png').write_bytes((D/'covered_route_marker.png').read_bytes())

call('create_texture', {'name': 'covered_route_marker_damp', 'data': str(D/'covered_route_marker_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'covered_route_marker_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 0], {
        'front_damp': [0, 9.0, 18],
        'three_quarter_damp': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('covered_route_marker', 'Covered-route marker', 'White floor tiles', 'Column lower shaft', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['covered_route_marker.png', 'covered_route_marker_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'marker_close.png', 'canopy_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Covered-route marker complete and verified with 100% full coverage!")
