import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# Rails split at 0.0
c('frame_rail_fl', [-6.0, 0.8, -13.0], [-4.5, 2.0, 0.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])
c('frame_rail_rl', [-6.0, 0.8, 0.0], [-4.5, 2.0, 13.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])
c('frame_rail_fr', [4.5, 0.8, -13.0], [6.0, 2.0, 0.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])
c('frame_rail_rr', [4.5, 0.8, 0.0], [6.0, 2.0, 13.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])

# Crossmembers
c('cross_front', [-4.5, 0.8, -11.5], [4.5, 1.8, -10.0], 'dark_chassis', off=['down', 'up', 'west', 'east'])
c('cross_mid',   [-4.5, 0.8, -0.8],  [4.5, 1.8, 0.8],    'dark_chassis', off=['down', 'up', 'west', 'east'])
c('cross_rear',  [-4.5, 0.8, 10.0],  [4.5, 1.8, 11.5],   'dark_chassis', off=['down', 'up', 'west', 'east'])

# Axle hubs
c('hub_fl', [-8.8, 0.0, -10.5], [-6.0, 3.2, -8.0], 'dark_chassis', off=['down', 'east'])
c('hub_fr', [6.0, 0.0, -10.5], [8.8, 3.2, -8.0], 'dark_chassis', off=['down', 'west'])
c('hub_rl', [-8.8, 0.0, 8.0], [-6.0, 3.2, 10.5], 'dark_chassis', off=['down', 'east'])
c('hub_rr', [6.0, 0.0, 8.0], [8.8, 3.2, 10.5], 'dark_chassis', off=['down', 'west'])

# Cabin tub
c('floor_pan', [-7.5, 2.0, -6.5], [7.5, 2.6, 7.5], 'rusted_steel', off=['down', 'north', 'south', 'west', 'east'])
c('trans_tunnel', [-1.5, 2.6, -6.5], [1.5, 3.8, 7.5], 'rusted_steel', off=['down', 'north', 'south'])

c('seat_dr_base', [-6.0, 2.6, -2.0], [-2.5, 3.5, 1.5], 'rusted_steel', off=['down'])
c('seat_dr_back', [-6.0, 3.5, 0.8], [-2.5, 8.0, 1.5], 'rusted_steel', off=['down'])

c('seat_pa_base', [2.5, 2.6, -2.0], [6.0, 3.5, 1.5], 'rusted_steel', off=['down'])
c('seat_pa_back', [2.5, 3.5, 0.8], [6.0, 8.0, 1.5], 'rusted_steel', off=['down'])

c('dash_tube',   [-7.5, 6.0, -6.0], [7.5, 7.0, -5.0], 'rusted_steel')
c('steer_stub',  [-5.0, 5.5, -5.0], [-3.8, 8.0, -3.8], 'dark_chassis', off=['north'])

# Engine bay
c('firewall', [-8.2, 2.0, -7.2], [8.2, 7.5, -6.5], 'burned_metal', off=['down', 'south'])
c('engine_block',  [-2.8, 1.8, -11.0], [2.8, 5.5, -7.5], 'dark_chassis', off=['down'])
c('intake_plenum', [-1.6, 5.5, -10.5], [1.6, 6.5, -8.0], 'rusted_steel', off=['down'])
c('radiator_core', [-7.0, 1.2, -13.6], [7.0, 6.5, -13.0], 'burned_metal', off=['down', 'south', 'north'])
c('front_bumper_bar', [-9.0, 0.8, -14.5], [9.0, 3.2, -13.6], 'burned_metal', off=['down', 'south'])
c('fender_sk_fl', [-8.5, 3.0, -13.5], [-7.5, 7.5, -10.5], 'charred_soot', off=['down', 'south'])
c('fender_sk_fr', [7.5, 3.0, -13.5], [8.5, 7.5, -10.5], 'charred_soot', off=['down', 'south'])

# Rear deck
c('rear_deck_floor', [-6.0, 2.0, 7.5], [6.0, 2.6, 13.0], 'burned_metal', off=['down', 'north', 'south'])
c('rear_bumper_bar', [-9.0, 0.8, 13.2], [9.0, 3.2, 14.2], 'burned_metal', off=['down', 'north'])
c('quarter_l', [-8.8, 3.0, 10.5], [-7.8, 8.0, 13.2], 'charred_soot', off=['down', 'north', 'south'])
c('quarter_r', [7.8, 3.0, 10.5], [8.8, 8.0, 13.2], 'charred_soot', off=['down', 'north', 'south'])

# Roof cage
c('rocker_l', [-8.6, 2.0, -6.5], [-7.5, 3.0, 7.5], 'charred_soot', off=['down', 'north', 'south', 'up', 'east'])
c('rocker_r', [7.5, 2.0, -6.5], [8.6, 3.0, 7.5], 'charred_soot', off=['down', 'north', 'south', 'up', 'west'])
c('pillar_a_l', [-8.2, 7.5, -6.5], [-7.2, 12.8, -3.5], 'charred_soot', off=['up'])
c('pillar_a_r', [7.2, 7.5, -6.5], [8.2, 12.8, -3.5], 'charred_soot', off=['up'])
c('header_rail', [-7.2, 12.0, -4.2], [7.2, 12.8, -3.2], 'charred_soot', off=['west', 'east'])
c('pillar_b_l', [-8.4, 3.0, 0.2], [-7.4, 12.8, 1.2], 'charred_soot', off=['down', 'up'])
c('pillar_b_r', [7.4, 3.0, 0.2], [8.4, 12.8, 1.2], 'charred_soot', off=['down', 'up'])
c('pillar_c_l', [-8.4, 8.0, 6.5], [-7.4, 12.8, 8.5], 'charred_soot', off=['up'])
c('pillar_c_r', [7.4, 8.0, 6.5], [8.4, 12.8, 8.5], 'charred_soot', off=['up'])
c('roof_rail_l', [-8.2, 12.8, -3.5], [-7.2, 13.6, 8.5], 'charred_soot', off=['down'])
c('roof_rail_r', [7.2, 12.8, -3.5], [8.2, 13.6, 8.5], 'charred_soot', off=['down'])
c('roof_skin_front', [-7.2, 13.0, -3.2], [7.2, 13.5, 0.5], 'charred_soot', off=['west', 'east', 'south'])
c('roof_skin_sag',   [-6.8, 12.2, 0.5],  [6.8, 12.8, 4.8], 'charred_soot', off=['west', 'east', 'north', 'south'])
c('roof_skin_rear',  [-7.2, 12.7, 4.8],  [7.2, 13.3, 8.5], 'charred_soot', off=['west', 'east', 'north'])

regions = {
    'charred_soot': (0, 0, 'blackstone_top.png', 16, 16),
    'burned_metal': (16, 0, 'cauldron_side.png', 16, 16),
    'rusted_steel': (32, 0, 'raw_iron_block.png', 16, 16),
    'dark_chassis': (48, 0, 'netherite_block.png', 16, 16),
}

# Check all UV values are <= 16
for q in cs:
    dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
    m, off, rot = a[q['name']]
    x, y, f = regions[m][:3]
    for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
        if face not in off:
            u = [x/4, y/4, (x+w)/4, (y+h)/4]
            assert all(0 <= n <= 16 for n in u), f"UV out of bounds for {q['name']} {face}: {u}"

errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Collisions: {errs}"
print(f"All {len(cs)} cubes have 0 errors and all UVs strictly in [0, 16]!")
