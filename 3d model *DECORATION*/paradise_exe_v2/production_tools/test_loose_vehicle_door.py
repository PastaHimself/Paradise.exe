import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Lower Door Outer Skin (stamped curved exterior panel)
# Lower portion: [0.0, 4.0], thickness Z: [0.0, 0.8]
c('outer_skin_bot', [-6.5, 0.0, 0.0], [6.5, 4.0, 0.8], 'painted_metal', off=['up', 'north', 'down'])
# Upper portion (beltline bulge): [4.0, 7.0], thickness Z: [0.0, 1.0]
c('outer_skin_top', [-6.5, 4.0, 0.0], [6.5, 7.0, 1.0], 'painted_metal', off=['down', 'north'])

# 2. Lower Door Inner Structure / Trim Card
# Interior base: [0.0, 7.0], thickness Z: [-0.8, 0.0]
c('inner_card', [-6.5, 0.0, -0.8], [6.5, 7.0, 0.0], 'interior_trim', off=['up', 'south', 'down'])
# Interior armrest / pull handle shelf: [3.0, 4.0], Z: [-1.2, -0.8]
c('inner_armrest', [-2.0, 3.0, -1.2], [3.0, 4.0, -0.8], 'interior_trim', off=['east', 'west', 'south'])

# 3. Exterior Door Handle
# Handle pocket recess: [5.0, 6.0], Z: [1.0, 1.3], X: [2.2, 4.8]
c('handle_bar', [2.2, 5.2, 1.0], [4.8, 5.8, 1.3], 'chrome_hardware', off=['north'])

# 4. Window Frame / Pillars
# Window beltline sill: [7.0, 7.3], Z: [-0.4, 0.4]
c('sill_weatherstrip', [-6.5, 7.0, -0.4], [6.5, 7.3, 0.4], 'rubber_seal', off=['down'])

# A-pillar front window run: X: [-6.5, -5.5], Y: [7.3, 13.0], Z: [-0.4, 0.4]
c('frame_front', [-6.5, 7.3, -0.4], [-5.5, 13.0, 0.4], 'painted_metal', off=['down', 'east'])

# B-pillar rear window run: X: [5.5, 6.5], Y: [7.3, 13.0], Z: [-0.4, 0.4]
c('frame_rear', [5.5, 7.3, -0.4], [6.5, 13.0, 0.4], 'painted_metal', off=['down', 'west'])

# Window header / top roof rail: X: [-5.5, 5.5], Y: [12.2, 13.0], Z: [-0.4, 0.4]
c('frame_top', [-5.5, 12.2, -0.4], [5.5, 13.0, 0.4], 'painted_metal', off=['west', 'east'])

# 5. Shattered Glass Remnants in lower window track
c('glass_shards', [-5.5, 7.3, -0.1], [5.5, 7.8, 0.1], 'shattered_glass', off=['down'])

# 6. Hinges (Front edge X: -7.0 to -6.5)
# Upper hinge: Y: [5.0, 6.2], Z: [-0.4, 0.4]
c('hinge_upper', [-7.0, 5.0, -0.4], [-6.5, 6.2, 0.4], 'iron_hardware', off=['east'])
c('hinge_pin_upper', [-7.3, 5.3, -0.2], [-7.0, 5.9, 0.2], 'iron_hardware', off=['east'])

# Lower hinge: Y: [1.0, 2.2], Z: [-0.4, 0.4]
c('hinge_lower', [-7.0, 1.0, -0.4], [-6.5, 2.2, 0.4], 'iron_hardware', off=['east'])
c('hinge_pin_lower', [-7.3, 1.3, -0.2], [-7.0, 1.9, 0.2], 'iron_hardware', off=['east'])

# 7. Latch Mechanism (Rear edge X: 6.5 to 7.0)
c('latch_catch', [6.5, 4.2, -0.4], [7.0, 5.2, 0.4], 'iron_hardware', off=['west'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Loose vehicle door geometry 100% clean with ZERO errors!")
