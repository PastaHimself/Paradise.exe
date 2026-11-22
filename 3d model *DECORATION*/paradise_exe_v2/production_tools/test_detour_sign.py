import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions
from glyphs import lettering

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: DETOUR SIGN
# -------------------------------------------------------------------------

# 1. Sign Plate (14.0 wide, 8.0 high, 0.4 thick, from Y=5.0 to 13.0, Z: 0.0 to 0.4)
c('plate', [-7.0, 5.0, 0.0], [7.0, 13.0, 0.4], 'orange', off=['north'])

# 2. Black Border Rim (Z: 0.4 to 0.48)
c('border_top', [-7.0, 12.6, 0.4], [7.0, 13.0, 0.48], 'ink', off=['north'])
c('border_bot', [-7.0, 5.0, 0.4], [7.0, 5.4, 0.48], 'ink', off=['north'])
c('border_l',   [-7.0, 5.4, 0.4], [-6.6, 12.6, 0.48], 'ink', off=['north', 'up', 'down'])
c('border_r',   [6.6, 5.4, 0.4], [7.0, 12.6, 0.48], 'ink', off=['north', 'up', 'down'])

# 3. DETOUR Lettering at Y=9.5, Z: 0.4 to 0.48, pixel=0.42
# Width: 23 * 0.42 = 9.66 units wide
lettering(cs, a, 'DETOUR', 0.42, 9.5, 0.4, material='ink', prefix='letter')
# Set cull faces for lettering elements
for q in cs:
    if q['name'].startswith('letter_'):
        # lettering creates boxes from Z to Z+pixel, let's adjust Z depth
        q['to'][2] = 0.48
        a[q['name']] = ('ink', ['north'], False)

# 4. Directional Arrow Pointing Right (at Y=6.5 to 8.5, Z: 0.4 to 0.48)
# Arrow shaft
c('arrow_shaft', [-3.5, 7.0, 0.4], [1.5, 8.0, 0.48], 'ink', off=['north', 'east'])
# Arrow head base bar
c('arrow_bar',   [1.5, 6.2, 0.4], [2.3, 8.8, 0.48], 'ink', off=['north', 'west', 'east'])
# Arrow head barb / tip
c('arrow_tip',   [2.3, 7.0, 0.4], [3.5, 8.0, 0.48], 'ink', off=['north', 'west'])

# 5. Mounting Posts (Two U-channel steel posts from Y=0.0 to 13.0, Z: -0.8 to 0.0)
c('post_l', [-4.6, 0.0, -0.6], [-4.0, 13.0, 0.0], 'steel', off=['down', 'south'])
c('post_r', [4.0, 0.0, -0.6], [4.6, 13.0, 0.0], 'steel', off=['down', 'south'])

# 6. Mounting Hardware Bolts (on sign face at Z: 0.4 to 0.6)
c('bolt_tl', [-4.5, 11.8, 0.4], [-4.1, 12.2, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [4.1, 11.8, 0.4], [4.5, 12.2, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-4.5, 5.8, 0.4], [-4.1, 6.2, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [4.1, 5.8, 0.4], [4.5, 6.2, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
