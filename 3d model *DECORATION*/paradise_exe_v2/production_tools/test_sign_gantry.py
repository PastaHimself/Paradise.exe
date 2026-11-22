import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Left Foundation & Column Tower (X: -14.0 to -11.6)
# Concrete footing pier
c('footing_l', [-14.0, 0.0, -1.8], [-11.6, 2.0, 1.8], 'concrete_base', off=['down'])
# Steel baseplate
c('baseplate_l', [-13.7, 2.0, -1.5], [-11.9, 2.5, 1.5], 'structural_steel', off=['down'])

# Left column legs: Front leg and Rear leg
c('leg_l_front', [-13.3, 2.5, 0.5], [-12.3, 22.0, 1.3], 'galvanized_steel', off=['down'])
c('leg_l_rear', [-13.3, 2.5, -1.3], [-12.3, 22.0, -0.5], 'galvanized_steel', off=['down'])

# Left column cross braces
c('brace_l_mid', [-13.1, 10.0, -0.5], [-12.5, 11.0, 0.5], 'structural_steel', off=['north', 'south'])
c('brace_l_high', [-13.1, 18.0, -0.5], [-12.5, 19.0, 0.5], 'structural_steel', off=['north', 'south'])

# 2. Right Foundation & Column Tower (X: 11.6 to 14.0)
# Concrete footing pier
c('footing_r', [11.6, 0.0, -1.8], [14.0, 2.0, 1.8], 'concrete_base', off=['down'])
# Steel baseplate
c('baseplate_r', [11.9, 2.0, -1.5], [13.7, 2.5, 1.5], 'structural_steel', off=['down'])

# Right column legs: Front leg and Rear leg
c('leg_r_front', [12.3, 2.5, 0.5], [13.3, 22.0, 1.3], 'galvanized_steel', off=['down'])
c('leg_r_rear', [12.3, 2.5, -1.3], [13.3, 22.0, -0.5], 'galvanized_steel', off=['down'])

# Right column cross braces
c('brace_r_mid', [12.5, 10.0, -0.5], [13.1, 11.0, 0.5], 'structural_steel', off=['north', 'south'])
c('brace_r_high', [12.5, 18.0, -0.5], [13.1, 19.0, 0.5], 'structural_steel', off=['north', 'south'])

# 3. Horizontal Overhead Truss (X: -13.5 to 13.5, Y: 22.0 to 27.5)
# Lower Chord Beams (split into left and right halves to keep UV span <= 16: [-13.5, 0.0] and [0.0, 13.5])
c('chord_bot_front_l', [-13.5, 22.0, 0.5], [0.0, 23.0, 1.3], 'galvanized_steel', off=['down', 'east'])
c('chord_bot_front_r', [0.0, 22.0, 0.5], [13.5, 23.0, 1.3], 'galvanized_steel', off=['down', 'west'])
c('chord_bot_rear_l', [-13.5, 22.0, -1.3], [0.0, 23.0, -0.5], 'galvanized_steel', off=['down', 'east'])
c('chord_bot_rear_r', [0.0, 22.0, -1.3], [13.5, 23.0, -0.5], 'galvanized_steel', off=['down', 'west'])

# Upper Chord Beams (split into left and right halves)
c('chord_top_front_l', [-13.5, 26.5, 0.5], [0.0, 27.5, 1.3], 'galvanized_steel', off=['east'])
c('chord_top_front_r', [0.0, 26.5, 0.5], [13.5, 27.5, 1.3], 'galvanized_steel', off=['west'])
c('chord_top_rear_l', [-13.5, 26.5, -1.3], [0.0, 27.5, -0.5], 'galvanized_steel', off=['east'])
c('chord_top_rear_r', [0.0, 26.5, -1.3], [13.5, 27.5, -0.5], 'galvanized_steel', off=['west'])

# Vertical Web Struts connecting lower and upper chords
c('strut_vert_l', [-7.2, 23.0, 0.6], [-6.4, 26.5, 1.2], 'structural_steel', off=['down', 'up'])
c('strut_vert_mid', [-0.4, 23.0, 0.6], [0.4, 26.5, 1.2], 'structural_steel', off=['down', 'up'])
c('strut_vert_r', [6.4, 23.0, 0.6], [7.2, 26.5, 1.2], 'structural_steel', off=['down', 'up'])

# 4. Maintenance Catwalk Walkway Platform (Rear side)
# Grating platform plank: Z: [-2.5, -1.3], Y: [22.0, 22.4] (split left and right halves)
c('catwalk_l', [-11.5, 22.0, -2.5], [0.0, 22.4, -1.3], 'grating', off=['east', 'south'])
c('catwalk_r', [0.0, 22.0, -2.5], [11.5, 22.4, -1.3], 'grating', off=['west', 'south'])

# Safety Handrail: horizontal rail at Y: [24.5, 25.0], Z: [-2.5, -2.2]
c('handrail_l', [-11.5, 24.5, -2.5], [0.0, 25.0, -2.2], 'galvanized_steel', off=['east'])
c('handrail_r', [0.0, 24.5, -2.5], [11.5, 25.0, -2.2], 'galvanized_steel', off=['west'])

# Handrail vertical stanchions
c('stanchion_l', [-11.5, 22.4, -2.5], [-11.0, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])
c('stanchion_mid', [-0.25, 22.4, -2.5], [0.25, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])
c('stanchion_r', [11.0, 22.4, -2.5], [11.5, 24.5, -2.2], 'galvanized_steel', off=['down', 'up'])

# 5. Sign Mounting Bracket Clamps on Front Chord
c('sign_mount_l', [-4.5, 23.0, 1.3], [-3.5, 26.5, 1.7], 'structural_steel', off=['north'])
c('sign_mount_r', [3.5, 23.0, 1.3], [4.5, 26.5, 1.7], 'structural_steel', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Sign gantry geometry 100% clean with ZERO errors!")
