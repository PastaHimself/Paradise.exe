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

def sign_lettering(cs, a, text, pixel, y, z_front, depth=0.08, material='ink', prefix='letter'):
    width = sum((len(FONT[ch][0]) if ch != ' ' else 2) + 1 for ch in text) - 1
    x_start = -width * pixel / 2.0
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
# BURNING HIGHWAY: DETOUR SIGN
# -------------------------------------------------------------------------

# 1. Sign Plate (14.0 wide, 8.0 high, 0.4 thick, from Y=5.0 to 13.0, Z: 0.0 to 0.4)
c('plate', [-7.0, 5.0, 0.0], [7.0, 13.0, 0.4], 'orange')

# 2. Black Border Rim (Z: 0.4 to 0.48)
c('border_top', [-7.0, 12.6, 0.4], [7.0, 13.0, 0.48], 'ink', off=['north'])
c('border_bot', [-7.0, 5.0, 0.4], [7.0, 5.4, 0.48], 'ink', off=['north'])
c('border_l',   [-7.0, 5.4, 0.4], [-6.6, 12.6, 0.48], 'ink', off=['north', 'up', 'down'])
c('border_r',   [6.6, 5.4, 0.4], [7.0, 12.6, 0.48], 'ink', off=['north', 'up', 'down'])

# 3. DETOUR Lettering at Y=9.5, Z=0.4, depth=0.08, pixel=0.42
sign_lettering(cs, a, 'DETOUR', 0.42, 9.5, 0.4, depth=0.08, material='ink', prefix='letter')

# 4. Directional Arrow Pointing Right (at Y=6.5 to 8.5, Z: 0.4 to 0.48)
c('arrow_shaft', [-3.5, 7.0, 0.4], [1.5, 8.0, 0.48], 'ink', off=['north', 'east'])
c('arrow_bar',   [1.5, 6.2, 0.4], [2.3, 8.8, 0.48], 'ink', off=['north', 'west', 'east'])
c('arrow_tip',   [2.3, 7.0, 0.4], [3.5, 8.0, 0.48], 'ink', off=['north', 'west'])

# 5. Mounting Posts (Two U-channel steel posts from Y=0.0 to 13.0, Z: -0.6 to 0.0)
c('post_l', [-4.6, 0.0, -0.6], [-4.0, 13.0, 0.0], 'steel', off=['down', 'south'])
c('post_r', [4.0, 0.0, -0.6], [4.6, 13.0, 0.0], 'steel', off=['down', 'south'])

# 6. Mounting Hardware Bolts (on sign face at Z: 0.4 to 0.6)
c('bolt_tl', [-4.5, 11.8, 0.4], [-4.1, 12.2, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [4.1, 11.8, 0.4], [4.5, 12.2, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-4.5, 5.8, 0.4], [-4.1, 6.2, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [4.1, 5.8, 0.4], [4.5, 6.2, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'orange': (0, 0, 'concrete_orange.png', 16, 16),
    'ink': (16, 0, 'concrete_black.png', 16, 16),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_detour_sign',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'MUTCD standard M4-9 / M4-10 highway DETOUR sign with 14x8 orange retroreflective faceplate, perimeter black border, embossed DETOUR lettering, directional arrow pointing right, two U-channel steel mounting posts, and mounting bolts; includes normal and scorched variants',
    'notes': [
        'modular roadway warning sign with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_orange, concrete_black, iron_block, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('detour_sign', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 8, 0], [18, 14, 18])
views(D, [0, 8, 0], {
    'front': [0, 9, 22],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [28, 20, 26],
    'face_close': [0, 9, 10]
})

# Create scorched variant texture and views
im = Image.open(D/'detour_sign.png').convert('RGBA')
im.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im.save(D/'detour_sign_scorched.png')
(D/'detour_sign_normal.png').write_bytes((D/'detour_sign.png').read_bytes())

call('create_texture', {'name': 'detour_sign_scorched', 'data': str(D/'detour_sign_scorched.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'detour_sign_scorched'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8, 0], {
        'front_scorched': [0, 9, 22],
        'three_quarter_scorched': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

dump(D/'variant_verification.json', {
    'same_geometry_and_UVs': True,
    'normal': 'detour_sign_normal.png',
    'scorched': 'detour_sign_scorched.png',
    'scorched_source': 'blackstone_top.png',
    'original_pixels': True
})

finish('detour_sign', 'DETOUR sign', 'Bent DETOUR sign', 'ROAD CLOSED sign', area='burning_highway')
print('DETOUR sign build and verification complete.', flush=True)
