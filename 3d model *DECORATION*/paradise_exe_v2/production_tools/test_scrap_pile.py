import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base Flattened Sheet Metal Plate (lying flat on ground)
# X: [-7.0, 5.0], Y: [0.0, 0.4], Z: [-6.0, 4.0]
c('base_plate_main', [-7.0, 0.0, -6.0], [5.0, 0.4, 4.0], 'twisted_sheet', off=['down'])

# Buckled lip of base plate folded up at edge
c('plate_fold_lip', [-7.0, 0.4, 2.5], [-4.0, 1.2, 4.0], 'twisted_sheet', off=['south', 'west', 'down'])

# 2. Sheared Exhaust Pipe / Muffler Segment (angled along X)
# X: [-5.0, 3.5], Y: [0.4, 1.8], Z: [-4.5, -3.1]
c('exhaust_pipe', [-5.0, 0.4, -4.5], [3.5, 1.8, -3.1], 'scorched_metal', off=['down', 'east'])
# Muffler flange collar at one end: flush at X=3.5, Y: [0.4, 2.0]
c('pipe_flange', [3.5, 0.4, -4.8], [4.5, 2.0, -2.8], 'raw_metal', off=['west', 'down'])

# 3. Bent U-Channel Structural Steel Bracket (angled across pile)
c('uchannel_web', [-2.0, 0.4, -3.0], [-0.6, 1.0, 3.0], 'structural_steel', off=['down'])
c('uchannel_flange_l', [-2.0, 1.0, -3.0], [-1.6, 2.6, 3.0], 'structural_steel', off=['down'])
c('uchannel_flange_r', [-1.0, 1.0, -3.0], [-0.6, 2.6, 3.0], 'structural_steel', off=['down'])

# 4. Crumpled Body Panel Wedge (leaning across the U-channel)
c('crumpled_panel_body', [0.5, 0.4, -1.5], [4.5, 1.6, 1.5], 'twisted_sheet', off=['down'])
c('crumpled_panel_crease', [1.5, 1.6, -1.2], [4.5, 3.4, 1.2], 'twisted_sheet', off=['down'])

# 5. Brake Rotor / Disc Hub (leaning near edge)
c('rotor_disc', [-6.0, 0.4, -1.5], [-3.0, 3.2, -0.7], 'raw_metal', off=['down'])
c('rotor_hub', [-5.0, 1.3, -0.7], [-4.0, 2.3, -0.3], 'structural_steel', off=['north'])

# 6. Sheared Suspension Coil / Spring Segment
c('coil_ring_1', [2.0, 0.4, 2.0], [4.5, 1.2, 4.5], 'structural_steel', off=['down'])
c('coil_ring_2', [2.2, 1.2, 2.2], [4.3, 2.0, 4.3], 'structural_steel', off=['down'])

# 7. Shattered Safety Glass Cluster on Asphalt (outside base plate)
c('glass_patch_1', [-6.5, 0.0, 4.2], [-3.0, 0.2, 6.5], 'shattered_glass', off=['down'])
c('glass_patch_2', [5.2, 0.0, -5.5], [7.3, 0.2, -2.5], 'shattered_glass', off=['down'])

# 8. Stripped Wire Harness / Rubber Cable
c('cable_segment_1', [-4.0, 0.4, -5.5], [1.0, 0.7, -4.8], 'rubber_cable', off=['down'])
c('cable_segment_2', [5.2, 0.0, -2.0], [7.5, 0.3, -1.2], 'rubber_cable', off=['down'])

# 9. Sheared Bolts and Hardware Clips
c('bolt_cluster_1', [-3.5, 0.4, 0.5], [-2.5, 0.9, 1.5], 'raw_metal', off=['down'])
c('bolt_cluster_2', [-1.5, 0.4, 3.2], [-0.7, 0.9, 4.0], 'raw_metal', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Scrap pile geometry 100% clean with ZERO errors!")
