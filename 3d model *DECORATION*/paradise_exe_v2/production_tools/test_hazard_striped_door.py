import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Concrete Tunnel Wall Frame
# Left wall: X: [-8.0, -5.0], Y: [0.0, 20.0], Z: [-1.0, 1.0]
c('wall_left', [-8.0, 0.0, -1.0], [-5.0, 20.0, 1.0], 'concrete_wall', off=['down', 'east'])
# Right wall: X: [5.0, 8.0], Y: [0.0, 20.0], Z: [-1.0, 1.0]
c('wall_right', [5.0, 0.0, -1.0], [8.0, 20.0, 1.0], 'concrete_wall', off=['down', 'west'])
# Top lintel: X: [-5.0, 5.0], Y: [18.0, 20.0], Z: [-1.0, 1.0]
c('wall_lintel', [-5.0, 18.0, -1.0], [5.0, 20.0, 1.0], 'concrete_wall', off=['down', 'east', 'west'])
# Bottom threshold: X: [-5.0, 5.0], Y: [0.0, 1.0], Z: [-1.0, 1.0]
c('wall_sill', [-5.0, 0.0, -1.0], [5.0, 1.0, 1.0], 'concrete_wall', off=['down', 'east', 'west'])

# 2. Heavy Structural Steel Door Frame Casing
c('jamb_left', [-5.0, 1.0, -0.6], [-4.2, 18.0, 1.2], 'structural_steel', off=['down', 'up', 'west'])
c('jamb_right', [4.2, 1.0, -0.6], [5.0, 18.0, 1.2], 'structural_steel', off=['down', 'up', 'east'])
c('head_casing', [-4.2, 17.2, -0.6], [4.2, 18.0, 1.2], 'structural_steel', off=['up', 'east', 'west'])
c('sill_kickplate', [-4.2, 1.0, -0.6], [4.2, 1.6, 1.2], 'structural_steel', off=['down', 'east', 'west'])

# 3. Door Leaf Body
c('door_leaf', [-4.2, 1.6, 0.0], [4.2, 17.2, 0.8], 'steel_leaf', off=['down', 'up', 'east', 'west'])

# 4. Alternating Hazard Stripes
c('stripe_1_y', [-4.0, 1.6, 0.8], [4.0, 4.2, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_2_b', [-4.0, 4.2, 0.8], [4.0, 6.8, 1.0], 'hazard_black', off=['north', 'down'])
c('stripe_3_y', [-4.0, 6.8, 0.8], [4.0, 9.4, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_4_b', [-4.0, 9.4, 0.8], [4.0, 12.0, 1.0], 'hazard_black', off=['north', 'down'])
c('stripe_5_y', [-4.0, 12.0, 0.8], [4.0, 14.6, 1.0], 'hazard_yellow', off=['north', 'down'])
c('stripe_6_b', [-4.0, 14.6, 0.8], [4.0, 17.2, 1.0], 'hazard_black', off=['north', 'down', 'up'])

# 5. Panic Hardware & Hinges
c('panic_bar', [-3.2, 8.8, 1.0], [3.2, 9.6, 1.4], 'hardware', off=['north', 'west', 'east'])
c('panic_mount_l', [-3.6, 8.6, 1.0], [-3.2, 9.8, 1.3], 'hardware', off=['north'])
c('panic_mount_r', [3.2, 8.6, 1.0], [3.6, 9.8, 1.3], 'hardware', off=['north'])

c('hinge_upper', [-4.8, 14.5, 1.2], [-4.2, 16.0, 1.5], 'hardware', off=['north'])
c('hinge_lower', [-4.8, 2.5, 1.2], [-4.2, 4.0, 1.5], 'hardware', off=['north'])

# 6. Overhead Emergency Access Light
c('emergency_light', [-1.2, 18.4, 1.0], [1.2, 19.4, 1.6], 'light_fixture', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Hazard-striped service door geometry 100% clean with ZERO errors!")
