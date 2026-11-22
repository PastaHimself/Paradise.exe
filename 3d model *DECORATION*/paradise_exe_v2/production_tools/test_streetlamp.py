import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Concrete Base Footing
# Footing on ground: Y: [0.0, 2.0]
c('footing_base', [-2.0, 0.0, -2.0], [2.0, 2.0, 2.0], 'concrete_base', off=['down'])

# 2. Steel Anchor Baseplate
# Resting on footing: Y: [2.0, 2.6], X: [-1.6, 1.6], Z: [-1.6, 1.6]
c('baseplate', [-1.6, 2.0, -1.6], [1.6, 2.6, 1.6], 'structural_steel', off=['down'])

# 4 Corner Anchor Bolt Nuts
c('bolt_nw', [-1.4, 2.6, -1.4], [-1.0, 3.0, -1.0], 'hardware', off=['down'])
c('bolt_ne', [1.0, 2.6, -1.4], [1.4, 3.0, -1.0], 'hardware', off=['down'])
c('bolt_sw', [-1.4, 2.6, 1.0], [-1.0, 3.0, 1.4], 'hardware', off=['down'])
c('bolt_se', [1.0, 2.6, 1.0], [1.4, 3.0, 1.4], 'hardware', off=['down'])

# 3. Lower Mast Pole (Y: 2.6 to 15.0)
c('pole_lower', [-1.0, 2.6, -1.0], [1.0, 15.0, 1.0], 'galvanized_steel', off=['down'])

# Handhole cover plate on lower pole
c('handhole_cover', [-1.15, 4.0, -0.5], [-1.0, 6.5, 0.5], 'structural_steel', off=['east'])

# 4. Upper Tapered Mast Pole (Y: 15.0 to 24.6)
c('pole_upper', [-0.8, 15.0, -0.8], [0.8, 24.6, 0.8], 'galvanized_steel', off=['down'])

# Pole cap / tenon junction collar (Y: 24.6 to 25.4)
c('pole_collar', [-0.9, 24.6, -0.9], [0.9, 25.4, 0.9], 'structural_steel', off=['down'])

# 5. Cantilever Cobra Head Mast Arm (Sweeping forward along +Z towards roadway)
# Arm section 1: rising curve out
c('arm_step_1', [-0.6, 25.4, 0.0], [0.6, 27.2, 3.2], 'galvanized_steel', off=['down', 'north'])
# Arm section 2: arc apex
c('arm_step_2', [-0.5, 27.0, 3.2], [0.5, 28.5, 7.0], 'galvanized_steel', off=['down', 'north'])
# Arm section 3: horizontal reach
c('arm_step_3', [-0.4, 28.0, 7.0], [0.4, 28.8, 10.5], 'galvanized_steel', off=['down', 'north'])

# 6. Cobra Head Luminaire Fixture
# Fixture tenon slipfitter mount
c('tenon_mount', [-0.6, 28.1, 10.5], [0.6, 29.1, 11.5], 'structural_steel', off=['north'])

# Main cobra head body housing
c('cobra_housing', [-1.2, 28.0, 11.5], [1.2, 29.3, 14.2], 'luminaire_housing', off=['north'])

# Drop glass refractor lens (underside)
c('refractor_lens', [-1.0, 27.5, 12.0], [1.0, 28.0, 13.8], 'luminaire_lens', off=['up'])

# Photocell sensor receptacle on top
c('photocell', [-0.3, 29.3, 12.0], [0.3, 29.7, 12.6], 'structural_steel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Streetlamp geometry 100% clean with ZERO errors!")
