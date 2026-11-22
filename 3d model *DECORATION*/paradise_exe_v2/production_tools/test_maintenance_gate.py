import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Left Hinge Terminal Post
c('footing_l', [-12.0, 0.0, -1.6], [-9.6, 1.8, 1.6], 'concrete_base', off=['down'])
c('post_l', [-11.2, 1.8, -0.4], [-10.4, 16.0, 0.4], 'galvanized_steel', off=['down'])
c('cap_l', [-11.4, 16.0, -0.6], [-10.2, 17.5, 0.6], 'structural_steel', off=['down'])

# 2. Right Latch Terminal Post
c('footing_r', [9.6, 0.0, -1.6], [12.0, 1.8, 1.6], 'concrete_base', off=['down'])
c('post_r', [10.4, 1.8, -0.4], [11.2, 16.0, 0.4], 'galvanized_steel', off=['down'])
c('cap_r', [10.2, 16.0, -0.6], [11.4, 17.5, 0.6], 'structural_steel', off=['down'])

# 3. Gate Tubular Frame Rails & Stiles
# Bottom rail: split into left [-10.0, 0.0] and right [0.0, 9.8]
c('rail_bot_l', [-10.0, 2.2, -0.3], [0.0, 2.8, 0.3], 'galvanized_steel', off=['east'])
c('rail_bot_r', [0.0, 2.2, -0.3], [9.8, 2.8, 0.3], 'galvanized_steel', off=['west'])

# Top rail: split into left and right
c('rail_top_l', [-10.0, 13.8, -0.3], [0.0, 14.4, 0.3], 'galvanized_steel', off=['east'])
c('rail_top_r', [0.0, 13.8, -0.3], [9.8, 14.4, 0.3], 'galvanized_steel', off=['west'])

# Vertical stiles
c('stile_left', [-10.0, 2.8, -0.3], [-9.4, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])
c('stile_center', [-0.3, 2.8, -0.3], [0.3, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])
c('stile_right', [9.2, 2.8, -0.3], [9.8, 13.8, 0.3], 'galvanized_steel', off=['down', 'up'])

# 4. Chain Link Mesh Bay Panels
c('mesh_left', [-9.4, 2.8, -0.1], [-0.3, 13.8, 0.1], 'chain_mesh', off=['down', 'up', 'east', 'west'])
c('mesh_right', [0.3, 2.8, -0.1], [9.2, 13.8, 0.1], 'chain_mesh', off=['down', 'up', 'east', 'west'])

# 5. Security Hinges & Locking Chain Wrap
# Hinge clamps bridging post (-10.4) to stile (-10.0)
c('hinge_top', [-10.4, 12.0, -0.4], [-10.0, 13.5, 0.4], 'hardware', off=['east', 'west'])
c('hinge_bot', [-10.4, 3.2, -0.4], [-10.0, 4.7, 0.4], 'hardware', off=['east', 'west'])

# Chain wrap: front chain link loop and rear chain link loop bridging stile (X=9.8) and post (X=10.4)
c('chain_front', [9.3, 7.5, 0.4], [11.3, 8.5, 0.7], 'hardware', off=['north'])
c('chain_rear', [9.3, 7.5, -0.7], [11.3, 8.5, -0.4], 'hardware', off=['south'])
# Center padlock hanging from chain below
c('padlock', [10.0, 6.0, 0.4], [10.8, 7.5, 0.8], 'structural_steel', off=['north', 'up'])

# 6. Warning Signboard
c('warning_sign', [-2.5, 7.5, 0.3], [2.5, 10.5, 0.6], 'sign_yellow', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Maintenance gate geometry 100% clean with ZERO errors!")
