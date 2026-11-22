import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions
from glyphs import FONT

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

def sign_lettering_part(cs, a, text, pixel, y, z_front, x_offset, depth=0.08, material='ink', prefix='letter'):
    x = x_offset
    for col, ch in enumerate(text):
        if ch == ' ':
            x += 3 * pixel
            continue
        runs = []
        for line in FONT[ch]:
            row = []
            i = 0
            while i < len(line):
                if line[i] == '0':
                    i += 1
                    continue
                j = i + 1
                while j < len(line) and line[j] == '1':
                    j += 1
                row.append((i, j))
                i = j
            runs.append(row)
        seen = set()
        for row, items in enumerate(runs):
            for i, j in items:
                if (row, i, j) in seen:
                    continue
                k = row + 1
                while k < 5 and (i, j) in runs[k] and (k, i, j) not in seen:
                    k += 1
                for rr in range(row, k):
                    seen.add((rr, i, j))
                name = f'{prefix}_{col}_{row}_{i}'
                x_lo = x + i * pixel
                x_hi = x + j * pixel
                y_lo = y + (5 - k) * pixel
                y_hi = y + (5 - row) * pixel
                cs.append({'name': name, 'from': [x_lo, y_lo, z_front], 'to': [x_hi, y_hi, z_front + depth]})
                a[name] = (material, ['north', 'east', 'west', 'up', 'down'], False)
        x += (len(FONT[ch][0]) + 1) * pixel

# -------------------------------------------------------------------------
# BURNING HIGHWAY: BENT DETOUR SIGN (Crash Impact Deflection)
# -------------------------------------------------------------------------

# 1. Buckled Sign Plates (Left crushed backward, Right tilted)
# Left plate: X in [-7.0, -0.6], Y in [4.4, 12.4], Z in [-1.0, -0.6]
c('plate_l', [-7.0, 4.4, -1.0], [-0.6, 12.4, -0.6], 'orange')
# Crease transition: X in [-0.6, -0.2], Y in [4.8, 12.6], Z in [-0.6, 0.0]
c('plate_crease', [-0.6, 4.8, -0.6], [-0.2, 12.6, 0.0], 'orange', off=['west', 'east'])
# Right plate: X in [-0.2, 7.0], Y in [5.2, 13.2], Z in [0.0, 0.4]
c('plate_r', [-0.2, 5.2, 0.0], [7.0, 13.2, 0.4], 'orange')

# 2. Black Borders on Left Plate (Z: -0.6 to -0.52)
c('border_l_top', [-7.0, 12.0, -0.6], [-0.6, 12.4, -0.52], 'ink', off=['north'])
c('border_l_bot', [-7.0, 4.4, -0.6], [-0.6, 4.8, -0.52], 'ink', off=['north'])
c('border_l_outer', [-7.0, 4.8, -0.6], [-6.6, 12.0, -0.52], 'ink', off=['north', 'up', 'down'])

# 3. Black Borders on Right Plate (Z: 0.4 to 0.48)
c('border_r_top', [-0.2, 12.8, 0.4], [7.0, 13.2, 0.48], 'ink', off=['north'])
c('border_r_bot', [-0.2, 5.2, 0.4], [7.0, 5.6, 0.48], 'ink', off=['north'])
c('border_r_outer', [6.6, 5.6, 0.4], [7.0, 12.8, 0.48], 'ink', off=['north', 'up', 'down'])

# 4. Lettering
# Left plate letters 'DET': on left plate (Z = -0.6)
# start x for DET:
# width of DET = (4 + 4 + 3) = 11 pixels * 0.42 = 4.62
sign_lettering_part(cs, a, 'DET', 0.42, 8.9, -0.6, -5.5, depth=0.08, material='ink', prefix='let_l')

# Right plate letters 'OUR': on right plate (Z = 0.4)
# width of OUR = (4 + 4 + 3) = 11 pixels * 0.42 = 4.62
sign_lettering_part(cs, a, 'OUR', 0.42, 9.7, 0.4, 0.8, depth=0.08, material='ink', prefix='let_r')

# 5. Directional Arrow (bent across fold)
# Left arrow shaft segment
c('arrow_shaft_l', [-3.5, 6.4, -0.6], [-0.6, 7.4, -0.52], 'ink', off=['north'])
# Right arrow shaft segment
c('arrow_shaft_r', [-0.2, 7.2, 0.4], [1.5, 8.2, 0.48], 'ink', off=['north', 'east'])
# Right arrow head bar & tip
c('arrow_bar',     [1.5, 6.4, 0.4], [2.3, 9.0, 0.48], 'ink', off=['north', 'west', 'east'])
c('arrow_tip',     [2.3, 7.2, 0.4], [3.5, 8.2, 0.48], 'ink', off=['north', 'west'])

# 6. Bent Support Posts
# Left post (severely crumpled by collision)
# Lower stub: Y in [0, 3.2]
c('post_l_stub', [-4.6, 0.0, -0.6], [-4.0, 3.2, 0.0], 'steel', off=['down', 'up'])
# Bowed impact knuckle: Y in [3.2, 5.2], bowing forward
c('post_l_kink', [-4.7, 3.2, 0.0], [-3.9, 5.2, 0.6], 'steel', off=['down', 'up'])
# Twisted upper post: Y in [5.2, 11.2], pushed backward behind left plate
c('post_l_upper',[-4.6, 5.2, -1.6], [-4.0, 11.2, -1.0], 'steel', off=['down', 'south'])

# Right post (tilted)
c('post_r_lower', [4.0, 0.0, -0.6], [4.6, 5.5, 0.0], 'steel', off=['down', 'up', 'south'])
c('post_r_upper', [3.9, 5.5, -0.6], [4.5, 13.0, 0.0], 'steel', off=['down', 'south'])

# 7. Hardware Bolts (torn / sheared on left, intact on right)
# Upper left bolt popped / sheared off! Only lower torn hole washer:
c('bolt_bl', [-4.5, 5.2, -0.6], [-4.1, 5.6, -0.4], 'dark_metal', off=['north'])
# Right bolts intact:
c('bolt_tr', [4.0, 12.0, 0.4], [4.4, 12.4, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [4.0, 6.0, 0.4], [4.4, 6.4, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
