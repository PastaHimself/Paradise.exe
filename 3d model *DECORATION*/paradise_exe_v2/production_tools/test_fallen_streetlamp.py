import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Foundation Stub & Sheared Baseplate
# Concrete base footing remains at X: [-13.0, -9.0]
c('footing_stub', [-13.0, 0.0, -2.0], [-9.0, 1.8, 2.0], 'concrete_base', off=['down'])

# Sheared anchor baseplate warped on footing
c('sheared_baseplate', [-12.6, 1.8, -1.6], [-9.4, 2.3, 1.6], 'structural_steel', off=['down'])

# 4 Bent / Sheared Anchor Studs
c('stud_nw', [-12.3, 2.3, -1.3], [-11.9, 2.8, -0.9], 'hardware', off=['down'])
c('stud_ne', [-10.1, 2.3, -1.3], [-9.7, 2.8, -0.9], 'hardware', off=['down'])
c('stud_sw', [-12.3, 2.3, 0.9], [-11.9, 2.8, 1.3], 'hardware', off=['down'])
c('stud_se', [-10.1, 2.3, 0.9], [-9.7, 2.8, 1.3], 'hardware', off=['down'])

# Severed base wiring conduit stub in center of baseplate
c('conduit_stub', [-11.3, 2.3, -0.3], [-10.7, 2.7, 0.3], 'copper_wire', off=['down'])

# 2. Fallen Lower Mast Pole (lying on asphalt, sheared from base)
# Lower pole runs along +X: [-8.5, 2.0], resting on ground Y: [0.0, 2.0], Z: [-1.0, 1.0]
c('fallen_pole_lower', [-8.5, 0.0, -1.0], [2.0, 2.0, 1.0], 'galvanized_steel', off=['down', 'east'])

# Sheared torn base rim collar at detached end
c('torn_pole_base', [-8.8, 0.0, -1.1], [-8.5, 2.1, 1.1], 'structural_steel', off=['east', 'down'])

# Handhole inspection cover popped open / buckled
c('open_handhole_door', [-5.5, 2.0, -0.6], [-3.0, 2.3, 0.6], 'structural_steel', off=['down'])

# 3. Impact Dent / Buckle V-Crease in mid-mast
c('dent_crease', [2.0, 0.0, -0.9], [4.0, 1.6, 0.9], 'galvanized_steel', off=['down', 'west', 'east'])

# 4. Upper Tapered Mast Pole (deflected angle along +X)
c('fallen_pole_upper', [4.0, 0.0, 0.0], [11.5, 1.6, 1.6], 'galvanized_steel', off=['down', 'west'])

# Slipfitter pole collar ring
c('fallen_collar', [11.5, 0.0, 0.1], [12.2, 1.7, 1.7], 'structural_steel', off=['west', 'down'])

# 5. Crumpled Cantilever Mast Arm
c('crumpled_arm', [12.2, 0.0, 0.5], [14.0, 1.2, 3.2], 'galvanized_steel', off=['west', 'down'])

# 6. Smashed Cobra Head Luminaire Fixture (impact crushed against road)
c('smashed_housing', [12.8, 0.0, 3.2], [14.4, 1.0, 5.5], 'luminaire_housing', off=['north', 'down', 'west'])

# Shattered glass refractor shards on road beside housing
c('scattered_lens_shards', [11.0, 0.0, 3.5], [12.8, 0.2, 5.8], 'shattered_glass', off=['down', 'east'])

# Photocell knocked off / crushed
c('crushed_photocell', [13.2, 1.0, 4.0], [13.8, 1.3, 4.6], 'structural_steel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Fallen streetlamp geometry 100% clean with ZERO errors!")
