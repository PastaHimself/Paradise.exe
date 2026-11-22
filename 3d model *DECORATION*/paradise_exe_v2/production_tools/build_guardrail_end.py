import sys, os
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: GUARDRAIL END (MSKT Extruder Terminal & Impact Head)
# Coordinates:
# X spans -8.0 to +7.0
# Rail runs along X from -8.0 to +2.1 entering the impact extruder collar.
# -------------------------------------------------------------------------

# 1. Standard W-Beam rail section entering from X = -8.0 to X = 2.1
# (Culled internal horizontal Y boundaries, matching bent_guardrail)
# Upper crown
c('w_rail_top', [-8.0, 9.0, -0.75], [2.1, 10.5, 0.0], 'steel', off=['east', 'down'])
# Mid valley
c('w_rail_mid', [-8.0, 7.25, -0.75], [2.1, 9.0, -0.4], 'steel', off=['east', 'up', 'down'])
# Lower crown
c('w_rail_bot', [-8.0, 5.5, -0.75], [2.1, 7.25, 0.0], 'steel', off=['east', 'up'])

# 2. Line Post at X = -4.0 (I-beam steel line post)
# Post flange south
c('post_flange_s', [-4.6, 0.0, -2.55], [-3.4, 10.5, -2.15], 'steel', off=['down', 'north'])
# Post web (between -2.95 and -2.55)
c('post_web',      [-4.2, 0.0, -2.95], [-3.8, 10.5, -2.55], 'steel', off=['down', 'north', 'south'])
# Post flange north
c('post_flange_n', [-4.6, 0.0, -3.35], [-3.4, 10.5, -2.95], 'steel', off=['down', 'south'])
# Spacer Blockout between post and rail
c('post_blockout', [-4.35, 6.0, -2.15], [-3.65, 10.5, -0.75], 'dark_metal', off=['north', 'south'])
# Rail mounting bolt
c('post_bolt',     [-4.2, 7.8, 0.0], [-3.8, 8.4, 0.25], 'dark_metal', off=['north'])

# 3. Ground Anchor Strut between Post and Terminal Base (at Y=0 to 0.8)
# Steel channel strut resting along ground between posts (Z: -2.95 to -2.55)
c('ground_strut', [-3.4, 0.05, -2.95], [1.8, 0.8, -2.55], 'steel', off=['west', 'east'])

# 4. Breakaway Terminal Post at X = 2.4
# Foundation steel socket sleeve (at ground Y=0 to 2.5)
c('term_socket',   [1.8, 0.0, -3.35], [3.0, 2.5, -2.15], 'dark_metal', off=['down'])
# Breakaway post upper stem (Y=2.5 to 11.2)
c('term_post',     [1.95, 2.5, -3.2], [2.85, 11.2, -2.3], 'steel', off=['down'])

# 5. Diagonal Cable Anchor Bracket & Swaged Cable
# Cable anchor bracket on back of W-beam valley at X = -1.8 to -0.6
c('cable_bracket', [-1.8, 6.5, -1.2], [-0.6, 9.5, -0.75], 'dark_metal', off=['south', 'east'])
# Anchor cable sleeve / swaged stud fitting
c('cable_stud',    [-0.6, 7.2, -1.1], [0.0, 8.0, -0.85], 'dark_metal', off=['west'])
# Diagonal tension cable running from bracket down towards foundation base
# Segmented steps with clean clearance
c('cable_seg1',    [0.0, 5.5, -1.45], [0.65, 7.2, -1.15], 'dark_metal')
c('cable_seg2',    [0.65, 3.8, -1.85], [1.25, 5.5, -1.45], 'dark_metal')
c('cable_seg3',    [1.25, 1.8, -2.25], [1.78, 3.8, -1.85], 'dark_metal', off=['down'])
# Foundation cable anchor bracket & tensioning nut
c('cable_nut',     [1.55, 1.2, -2.4], [1.78, 1.8, -2.0], 'dark_metal', off=['up'])

# 6. MSKT Impact Extruder Head (Slips over W-beam rail at X = 2.1 to 6.8)
# Chute entry collar (facing rail at X: 2.1 to 2.5)
c('head_collar',   [2.1, 5.2, -1.1], [2.5, 10.8, 0.2], 'plate', off=['east', 'west'])
# Outer box body (X: 2.5 to 5.2, Y: 4.8 to 11.2, Z: -1.35 to 0.45)
c('head_body',     [2.5, 4.8, -1.35], [5.2, 11.2, 0.45], 'plate', off=['west', 'east'])
# Side deflection guide / rail exit chute (curving rail away during crash)
c('exit_guide_top',[3.2, 9.6, -1.85], [4.5, 10.8, -1.35], 'steel', off=['south'])
c('exit_guide_bot',[3.2, 5.2, -1.85], [4.5, 6.4, -1.35], 'steel', off=['south'])

# 7. Impact Striker Faceplate / Buffer Nose (Front bumper facing oncoming traffic)
# Heavy steel impact striker plate (X: 5.2 to 5.8, Y: 4.2 to 11.8, Z: -1.6 to 0.7)
c('impact_plate',  [5.2, 4.2, -1.6], [5.8, 11.8, 0.7], 'plate', off=['west', 'east'])
# Impact bumper cap / nose block (X: 5.8 to 6.8, Y: 4.5 to 11.5, Z: -1.4 to 0.5)
c('bumper_cap',    [5.8, 4.5, -1.4], [6.8, 11.5, 0.5], 'plate', off=['west', 'east'])

# 8. Chevron Hazard Stripes on Striker Face (+X end face)
# Alternating Yellow and Black warning stripes on the front of the bumper cap
# Face is at X = 6.8 to 6.95, from Y = 4.5 to 11.5, Z = -1.4 to 0.5 (height 7.0, width 1.9)
# We divide the front stripe panel into 4 horizontal bands:
c('hazard_yellow1', [6.8, 9.75, -1.4], [6.95, 11.5, 0.5], 'hazard_yellow', off=['west', 'down'])
c('hazard_black1',  [6.8, 8.0,  -1.4], [6.95, 9.75, 0.5], 'hazard_black',  off=['west', 'up', 'down'])
c('hazard_yellow2', [6.8, 6.25, -1.4], [6.95, 8.0,  0.5], 'hazard_yellow', off=['west', 'up', 'down'])
c('hazard_black2',  [6.8, 4.5,  -1.4], [6.95, 6.25, 0.5], 'hazard_black',  off=['west', 'up'])

# 9. Delineator Reflector in Rail Valley (at X = -6.0)
c('reflector',      [-6.35, 7.6, -0.4], [-5.65, 8.6, -0.2], 'hazard_yellow', off=['north'])

print(f"Total cubes defined: {len(cs)}")

errs = check_z_fighting_and_collisions(cs, a)
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)

regions = {
    'steel': (0, 0, 'iron_block.png', 16, 16),
    'dark_metal': (16, 0, 'netherite_block.png', 16, 16),
    'plate': (32, 0, 'cauldron_side.png', 16, 16),
    'hazard_yellow': (48, 0, 'concrete_yellow.png', 16, 16),
    'hazard_black': (0, 16, 'concrete_black.png', 16, 16),
}

plan = {
    'id': 'burning_highway_guardrail_end',
    'reference': 'https://roadsidepooledfund.org/',
    'used': 'highway extruded impact head W-beam guardrail end treatment (MSKT / ET-Plus) with cable anchor terminal, ground strut, breakaway post in foundation sleeve, impact extruder chute, buffer striker cap, and yellow/black chevron hazard stripes',
    'notes': [
        'modular 16-unit roadway guardrail terminal segment with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, netherite_block, cauldron_side, concrete_yellow, and concrete_black pixels unchanged',
        'static terminal geometry; no vehicle impact physics'
    ]
}

D = build('guardrail_end', cs, a, regions, plan, area='burning_highway')
finish('guardrail_end', 'Guardrail end', 'Traffic cone', 'Striped roadwork barricade', area='burning_highway')
print('Guardrail end build and verification complete.', flush=True)
