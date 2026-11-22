import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: BURNED-OUT VEHICLE SHELL (Minecraft Scale 28x18x14)
# Max dimensions: X: [-9.0, 9.0], Y: [0.0, 13.6], Z: [-14.5, 14.2] -> Fits 30x30x30!
# -------------------------------------------------------------------------

# GROUP 1: CHASSIS & RUNNING GEAR (Lower Frame)
c('frame_rail_l', [-6.0, 0.8, -13.0], [-4.5, 2.0, 13.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])
c('frame_rail_r', [4.5, 0.8, -13.0], [6.0, 2.0, 13.0], 'dark_chassis', off=['down', 'up', 'north', 'south'])

# Crossmembers (between rails)
c('cross_front', [-4.5, 0.8, -11.5], [4.5, 1.8, -10.0], 'dark_chassis', off=['down', 'up', 'west', 'east'])
c('cross_mid',   [-4.5, 0.8, -0.8],  [4.5, 1.8, 0.8],    'dark_chassis', off=['down', 'up', 'west', 'east'])
c('cross_rear',  [-4.5, 0.8, 10.0],  [4.5, 1.8, 11.5],   'dark_chassis', off=['down', 'up', 'west', 'east'])

# Axle hub stubs (flat brake rotors / wheel hubs sitting on the pavement)
c('hub_fl', [-8.8, 0.0, -10.5], [-6.0, 3.2, -8.0], 'dark_chassis', off=['down', 'east'])
c('hub_fr', [6.0, 0.0, -10.5], [8.8, 3.2, -8.0], 'dark_chassis', off=['down', 'west'])
c('hub_rl', [-8.8, 0.0, 8.0], [-6.0, 3.2, 10.5], 'dark_chassis', off=['down', 'east'])
c('hub_rr', [6.0, 0.0, 8.0], [8.8, 3.2, 10.5], 'dark_chassis', off=['down', 'west'])

# GROUP 2: CABIN TUB & FLOOR PAN
c('floor_pan', [-7.5, 2.0, -6.5], [7.5, 2.6, 7.5], 'rusted_steel', off=['down', 'north', 'south', 'west', 'east'])

# Transmission tunnel
c('trans_tunnel', [-1.5, 2.6, -6.5], [1.5, 3.8, 7.5], 'rusted_steel', off=['down', 'north', 'south'])

# Tubular seat frames
c('seat_dr_base', [-6.0, 2.6, -2.0], [-2.5, 3.5, 1.5], 'rusted_steel', off=['down'])
c('seat_dr_back', [-6.0, 3.5, 0.8], [-2.5, 8.0, 1.5], 'rusted_steel', off=['down'])

c('seat_pa_base', [2.5, 2.6, -2.0], [6.0, 3.5, 1.5], 'rusted_steel', off=['down'])
c('seat_pa_back', [2.5, 3.5, 0.8], [6.0, 8.0, 1.5], 'rusted_steel', off=['down'])

# Dashboard cross-tube & steering column stub
c('dash_tube',   [-7.5, 6.0, -6.0], [7.5, 7.0, -5.0], 'rusted_steel')
c('steer_stub',  [-5.0, 5.5, -5.0], [-3.8, 8.0, -3.8], 'dark_chassis', off=['north'])

# GROUP 3: ENGINE BAY & FRONT CLIP
c('firewall', [-8.2, 2.0, -7.2], [8.2, 7.5, -6.5], 'burned_metal', off=['down', 'south'])

# Charred engine block in engine bay
c('engine_block',  [-2.8, 1.8, -11.0], [2.8, 5.5, -7.5], 'dark_chassis', off=['down'])
c('intake_plenum', [-1.6, 5.5, -10.5], [1.6, 6.5, -8.0], 'rusted_steel', off=['down'])

# Front radiator core support
c('radiator_core', [-7.0, 1.2, -13.6], [7.0, 6.5, -13.0], 'burned_metal', off=['down', 'south', 'north'])

# Front bumper bar
c('front_bumper_bar', [-9.0, 0.8, -14.5], [9.0, 3.2, -13.6], 'burned_metal', off=['down', 'south'])

# Front fender skirts
c('fender_sk_fl', [-8.5, 3.0, -13.5], [-7.5, 7.5, -10.5], 'charred_soot', off=['down', 'south'])
c('fender_sk_fr', [7.5, 3.0, -13.5], [8.5, 7.5, -10.5], 'charred_soot', off=['down', 'south'])

# GROUP 4: REAR DECK & QUARTER PANELS
c('rear_deck_floor', [-6.0, 2.0, 7.5], [6.0, 2.6, 13.0], 'burned_metal', off=['down', 'north', 'south'])

# Rear bumper bar
c('rear_bumper_bar', [-9.0, 0.8, 13.2], [9.0, 3.2, 14.2], 'burned_metal', off=['down', 'north'])

# Rear quarter panels
c('quarter_l', [-8.8, 3.0, 10.5], [-7.8, 8.0, 13.2], 'charred_soot', off=['down', 'north', 'south'])
c('quarter_r', [7.8, 3.0, 10.5], [8.8, 8.0, 13.2], 'charred_soot', off=['down', 'north', 'south'])

# GROUP 5: ROOF CAGE & PILLARS
c('rocker_l', [-8.6, 2.0, -6.5], [-7.5, 3.0, 7.5], 'charred_soot', off=['down', 'north', 'south', 'up', 'east'])
c('rocker_r', [7.5, 2.0, -6.5], [8.6, 3.0, 7.5], 'charred_soot', off=['down', 'north', 'south', 'up', 'west'])

# A-pillars
c('pillar_a_l', [-8.2, 7.5, -6.5], [-7.2, 12.8, -3.5], 'charred_soot', off=['up'])
c('pillar_a_r', [7.2, 7.5, -6.5], [8.2, 12.8, -3.5], 'charred_soot', off=['up'])

# Windshield header rail
c('header_rail', [-7.2, 12.0, -4.2], [7.2, 12.8, -3.2], 'charred_soot', off=['west', 'east'])

# B-pillars
c('pillar_b_l', [-8.4, 3.0, 0.2], [-7.4, 12.8, 1.2], 'charred_soot', off=['down', 'up'])
c('pillar_b_r', [7.4, 3.0, 0.2], [8.4, 12.8, 1.2], 'charred_soot', off=['down', 'up'])

# C-pillars
c('pillar_c_l', [-8.4, 8.0, 6.5], [-7.4, 12.8, 8.5], 'charred_soot', off=['up'])
c('pillar_c_r', [7.4, 8.0, 6.5], [8.4, 12.8, 8.5], 'charred_soot', off=['up'])

# Roof side rails
c('roof_rail_l', [-8.2, 12.8, -3.5], [-7.2, 13.6, 8.5], 'charred_soot', off=['down'])
c('roof_rail_r', [7.2, 12.8, -3.5], [8.2, 13.6, 8.5], 'charred_soot', off=['down'])

# Roof skins
c('roof_skin_front', [-7.2, 13.0, -3.2], [7.2, 13.5, 0.5], 'charred_soot', off=['west', 'east', 'south'])
c('roof_skin_sag',   [-6.8, 12.2, 0.5],  [6.8, 12.8, 4.8], 'charred_soot', off=['west', 'east', 'north', 'south'])
c('roof_skin_rear',  [-7.2, 12.7, 4.8],  [7.2, 13.3, 8.5], 'charred_soot', off=['west', 'east', 'north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Vehicle shell geometry 100% clean with ZERO errors!")
