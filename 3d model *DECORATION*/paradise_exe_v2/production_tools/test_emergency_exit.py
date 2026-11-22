import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions
from glyphs import FONT

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

def sign_lettering(cs, a, text, pixel, y, z_front, depth=0.08, material='ink', prefix='letter', x_center=0.0):
    width = sum((len(FONT[ch][0]) if ch != ' ' else 2) + 1 for ch in text) - 1
    x_start = x_center - width * pixel / 2.0
    x = x_start
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
# BURNING HIGHWAY: EMERGENCY EXIT SIGN (MUTCD E5-1 Highway Egress Sign)
# -------------------------------------------------------------------------

# 1. Sign Plate (16.0 wide, 9.0 high, 0.4 thick, from Y=6.0 to 15.0, Z: 0.0 to 0.4)
c('plate', [-8.0, 6.0, 0.0], [8.0, 15.0, 0.4], 'green')

# 2. White Border Rim (Z: 0.4 to 0.48)
c('border_top', [-8.0, 14.6, 0.4], [8.0, 15.0, 0.48], 'white', off=['north'])
c('border_bot', [-8.0, 6.0, 0.4], [8.0, 6.4, 0.48], 'white', off=['north'])
c('border_l',   [-8.0, 6.4, 0.4], [-7.6, 14.6, 0.48], 'white', off=['north', 'up', 'down'])
c('border_r',   [7.6, 6.4, 0.4], [8.0, 14.6, 0.48], 'white', off=['north', 'up', 'down'])

# 3. Lettering
# Line 1: 'EMERGENCY' centered at Y=11.6, pixel=0.35
sign_lettering(cs, a, 'EMERGENCY', 0.35, 11.6, 0.4, depth=0.08, material='white', prefix='let_emerg', x_center=0.0)

# Line 2: 'EXIT' on left at Y=7.5, pixel=0.38, centered around X=-3.0
sign_lettering(cs, a, 'EXIT', 0.38, 7.5, 0.4, depth=0.08, material='white', prefix='let_exit', x_center=-2.8)

# Directional Arrow pointing right on right at Y=7.5 to 9.4
c('arrow_shaft', [1.5, 8.0, 0.4], [4.2, 8.9, 0.48], 'white', off=['north', 'east'])
c('arrow_bar',   [4.2, 7.2, 0.4], [4.9, 9.7, 0.48], 'white', off=['north', 'west', 'east'])
c('arrow_tip',   [4.9, 8.0, 0.4], [5.9, 8.9, 0.48], 'white', off=['north', 'west'])

# 4. Support Posts (Two U-channel steel posts from Y=0.0 to 15.0, Z: -0.6 to 0.0)
c('post_l', [-5.6, 0.0, -0.6], [-5.0, 15.0, 0.0], 'steel', off=['down', 'south'])
c('post_r', [5.0, 0.0, -0.6], [5.6, 15.0, 0.0], 'steel', off=['down', 'south'])

# 5. Horizontal Backing Channels
for name, y1, y2 in [('str_top', 13.7, 14.6), ('str_bot', 6.4, 7.2)]:
    c(f'{name}_l', [-7.5, y1, -0.45], [-5.6, y2, 0.0], 'steel', off=['south', 'east'])
    c(f'{name}_mid', [-5.0, y1, -0.45], [5.0, y2, 0.0], 'steel', off=['south', 'west', 'east'])
    c(f'{name}_r', [5.6, y1, -0.45], [7.5, y2, 0.0], 'steel', off=['south', 'west'])

# 6. Mounting Hardware Bolts (on sign face at Z: 0.4 to 0.6)
c('bolt_tl', [-5.5, 13.9, 0.4], [-5.1, 14.4, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [5.1, 13.9, 0.4], [5.5, 14.4, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-5.5, 6.5, 0.4], [-5.1, 7.0, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [5.1, 6.5, 0.4], [5.5, 7.0, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
