import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Concrete Base Footing & Anchor Baseplate
c('footing_base', [-3.0, 0.0, -2.5], [3.0, 1.8, 2.5], 'concrete_base', off=['down'])
c('baseplate', [-2.5, 1.8, -2.0], [2.5, 2.3, 2.0], 'structural_steel', off=['down'])

# 2. Steel Column Mast (Y: 2.3 to 10.0)
c('column_mast', [-1.2, 2.3, -1.2], [1.2, 10.0, 1.2], 'galvanized_steel', off=['down'])

# 3. Main Phone Housing (Y: 10.0 to 17.5)
# Main body box (behind recess): Z: [-2.2, 1.2]
c('housing_body', [-2.8, 10.0, -2.2], [2.8, 17.5, 1.2], 'phone_orange', off=['down'])

# Recessed Intercom Cavity (Z: 1.2 to 2.5)
# Left wind baffle side wall
c('baffle_left', [-2.8, 10.5, 1.2], [-2.0, 17.0, 2.5], 'phone_orange', off=['north'])
# Right wind baffle side wall
c('baffle_right', [2.0, 10.5, 1.2], [2.8, 17.0, 2.5], 'phone_orange', off=['north'])
# Bottom shelf of recess
c('shelf_bottom', [-2.0, 10.5, 1.2], [2.0, 11.2, 2.5], 'phone_orange', off=['north', 'west', 'east'])
# Top canopy brow of recess
c('canopy_top', [-2.8, 17.0, 1.2], [2.8, 17.5, 2.5], 'phone_orange', off=['north', 'down'])

# 4. Phone Interface Components (inside the recess)
# Speaker / Mic grille plate
c('intercom_grille', [-1.2, 14.0, 1.2], [1.2, 16.0, 1.5], 'dark_metal', off=['north'])
# Emergency Red SOS Push Button
c('sos_button', [-0.6, 12.0, 1.2], [0.6, 13.2, 1.8], 'button_red', off=['north'])

# 5. Top SOS Badge Panel (Y: 17.5 to 19.5)
c('sos_badge_panel', [-2.2, 17.5, -1.8], [2.2, 19.5, 1.8], 'sos_blue', off=['down'])

# 6. Solar Panel Riser & Collector (Y: 19.5 to 22.8)
c('solar_riser', [-0.6, 19.5, -0.6], [0.6, 21.6, 0.6], 'structural_steel', off=['down'])
c('solar_panel', [-3.0, 21.6, -2.5], [3.0, 22.4, 2.5], 'solar_cell', off=['down'])

# 7. Blue Flashing Emergency Strobe Beacon (Y: 22.4 to 24.0)
c('strobe_beacon', [-0.8, 22.4, -0.8], [0.8, 24.0, 0.8], 'strobe_blue', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Emergency phone box geometry 100% clean with ZERO errors!")
