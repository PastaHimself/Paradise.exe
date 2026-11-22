import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from views import views
from audit_geometry import check_z_fighting_and_collisions
from glyphs import FONT

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

def sign_lettering(cs, a, text, pixel, y, z_front, depth=0.08, material='white', prefix='letter', x_center=0.0):
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
# BURNING HIGHWAY: OVERHEAD DIRECTION SIGN (MUTCD Freeway Guide Sign)
# -------------------------------------------------------------------------

# 1. Sign Plate (22.0 wide, 11.0 high, 0.4 thick, Y: 4.0 to 15.0, Z: 0.0 to 0.4)
c('plate', [-11.0, 4.0, 0.0], [11.0, 15.0, 0.4], 'green')

# 2. White Perimeter Border & Center Divider (Z: 0.4 to 0.48)
c('border_top', [-11.0, 14.6, 0.4], [11.0, 15.0, 0.48], 'white', off=['north'])
c('border_bot', [-11.0, 4.0, 0.4], [11.0, 4.4, 0.48], 'white', off=['north'])
c('border_l',   [-11.0, 4.4, 0.4], [-10.6, 14.6, 0.48], 'white', off=['north', 'up', 'down'])
c('border_r',   [10.6, 4.4, 0.4], [11.0, 14.6, 0.48], 'white', off=['north', 'up', 'down'])
c('divider',    [-0.2, 4.4, 0.4], [0.2, 14.6, 0.46], 'white', off=['north', 'up', 'down'])

# 3. Destination Lettering
# Left: "WEST" centered at X=-5.5, Y=10.5, pixel=0.42
sign_lettering(cs, a, 'WEST', 0.42, 10.5, 0.4, depth=0.08, material='white', prefix='let_w', x_center=-5.5)

# Right: "EAST" centered at X=5.5, Y=10.5, pixel=0.42
sign_lettering(cs, a, 'EAST', 0.42, 10.5, 0.4, depth=0.08, material='white', prefix='let_e', x_center=5.5)

# 4. Directional Arrows
# Left Lane: Straight/Through arrow pointing UP
c('arr_up_shaft', [-6.0, 5.2, 0.4], [-5.0, 7.8, 0.48], 'white', off=['north', 'up'])
c('arr_up_barb',  [-6.8, 7.8, 0.4], [-4.2, 8.5, 0.48], 'white', off=['north', 'down', 'up'])
c('arr_up_peak',  [-6.0, 8.5, 0.4], [-5.0, 9.4, 0.48], 'white', off=['north', 'down'])

# Right Lane: Slanted exit arrow pointing UP-RIGHT (stepped diagonal)
c('arr_sl_step1', [4.0, 5.2, 0.4], [5.0, 6.2, 0.48], 'white', off=['north', 'east', 'up'])
c('arr_sl_step2', [5.0, 6.2, 0.4], [6.0, 7.2, 0.48], 'white', off=['north', 'west', 'down', 'east', 'up'])
c('arr_sl_step3', [6.0, 7.2, 0.4], [7.0, 8.2, 0.48], 'white', off=['north', 'west', 'down', 'east', 'up'])
c('arr_sl_top',   [5.0, 8.2, 0.4], [7.0, 9.0, 0.48], 'white', off=['north', 'down', 'east'])
c('arr_sl_wing',  [7.0, 7.0, 0.4], [7.8, 9.0, 0.48], 'white', off=['north', 'west'])

# 5. Support Posts & Overhead Gantry Clamps
c('post_l', [-7.8, 3.5, -0.6], [-7.0, 16.5, 0.0], 'steel', off=['south', 'down'])
c('post_r', [7.0, 3.5, -0.6], [7.8, 16.5, 0.0], 'steel', off=['south', 'down'])

c('clamp_l_top',  [-8.0, 16.5, -1.2], [-6.8, 17.0, 0.2], 'steel', off=['down'])
c('clamp_l_back', [-8.0, 15.5, -1.2], [-6.8, 16.5, -0.6], 'steel', off=['east', 'west', 'south'])
c('clamp_r_top',  [6.8, 16.5, -1.2], [8.0, 17.0, 0.2], 'steel', off=['down'])
c('clamp_r_back', [6.8, 15.5, -1.2], [8.0, 16.5, -0.6], 'steel', off=['east', 'west', 'south'])

# 6. Horizontal Backing Stiffeners
for name, y1, y2 in [('str_top', 13.2, 14.0), ('str_bot', 4.8, 5.6)]:
    c(f'{name}_l',   [-10.5, y1, -0.45], [-7.8, y2, 0.0], 'steel', off=['south', 'east'])
    c(f'{name}_mid', [-7.0, y1, -0.45], [7.0, y2, 0.0], 'steel', off=['south', 'west', 'east'])
    c(f'{name}_r',   [7.8, y1, -0.45], [10.5, y2, 0.0], 'steel', off=['south', 'west'])

# 7. Mounting Hardware Bolts
c('bolt_tl', [-7.6, 13.4, 0.4], [-7.2, 13.8, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [7.2, 13.4, 0.4], [7.6, 13.8, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-7.6, 5.0, 0.4], [-7.2, 5.4, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [7.2, 5.0, 0.4], [7.6, 5.4, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'green': (0, 0, 'concrete_green.png', 16, 16),
    'white': (16, 0, 'concrete_white.png', 16, 16),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_overhead_direction_sign',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'MUTCD standard Chapter 2E freeway overhead guide sign with 22x11 green retroreflective faceplate, perimeter white border, vertical lane divider, WEST mainline destination with vertical through arrow, EAST diverge destination with diagonal exit arrow, dual structural steel struts with overhead gantry clamp brackets, backing stiffeners, and hardware bolts; includes directional and scorched variants',
    'notes': [
        'overhead highway guide sign with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_green, concrete_white, iron_block, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('overhead_direction_sign', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 10, 0], [22, 18, 22])
views(D, [0, 10, 0], {
    'front': [0, 10, 26],
    'three_quarter': [22, 18, 22],
    'back': [-22, 18, -22],
    'gameplay_scale': [32, 24, 30],
    'face_close': [0, 10, 14]
})

# Create scorched variant texture and views
im = Image.open(D/'overhead_direction_sign.png').convert('RGBA')
im.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im.save(D/'overhead_direction_sign_scorched.png')
(D/'overhead_direction_sign_normal.png').write_bytes((D/'overhead_direction_sign.png').read_bytes())

call('create_texture', {'name': 'overhead_direction_sign_scorched', 'data': str(D/'overhead_direction_sign_scorched.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'overhead_direction_sign_scorched'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10, 0], {
        'front_scorched': [0, 10, 26],
        'three_quarter_scorched': [22, 18, 22]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

dump(D/'variant_verification.json', {
    'same_geometry_and_UVs': True,
    'normal': 'overhead_direction_sign_normal.png',
    'scorched': 'overhead_direction_sign_scorched.png',
    'scorched_source': 'blackstone_top.png',
    'original_pixels': True
})

finish('overhead_direction_sign', 'Overhead direction sign', 'Bent overhead direction sign', 'Burned-out vehicle shell', area='burning_highway')
print('Overhead direction sign build and verification complete.', flush=True)
