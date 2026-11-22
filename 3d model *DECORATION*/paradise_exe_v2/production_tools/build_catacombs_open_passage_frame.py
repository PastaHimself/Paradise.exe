import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Catacombs: Open-passage frame
# 1. Threshold Sill (Y: 0.0 to 1.5)
c('sill_l', [-9.5, 0.0, -4.0], [-4.5, 1.5, 4.0], 'ashlar_stone')
c('sill_r', [4.5, 0.0, -4.0], [9.5, 1.5, 4.0], 'ashlar_stone')
c('worn_threshold', [-4.5, 0.0, -4.0], [4.5, 0.8, 4.0], 'cracked_stone')

# 2. Portal Jambs (Y: 1.5 to 16.5)
c('jamb_l', [-9.0, 1.5, -3.8], [-5.5, 16.5, 3.8], 'ashlar_stone')
c('jamb_r', [5.5, 1.5, -3.8], [9.0, 16.5, 3.8], 'ashlar_stone')
c('reveal_l', [-5.5, 1.5, -3.2], [-4.5, 16.5, 3.2], 'cracked_stone')
c('reveal_r', [4.5, 1.5, -3.2], [5.5, 16.5, 3.2], 'cracked_stone')

# 3. Lintel & Cornice (Y: 16.5 to 20.0)
c('lintel', [-9.5, 16.5, -4.0], [9.5, 18.8, 4.0], 'ashlar_stone')
c('cornice', [-10.0, 18.8, -4.4], [10.0, 20.0, 4.4], 'ashlar_stone')

# 4. Empty Iron Hinge Brackets & Pintle Pins (on right reveal)
c('hinge_bracket_upper', [4.0, 13.5, 0.5], [4.5, 14.5, 2.0], 'iron_metal')
c('hinge_bracket_lower', [4.0, 3.5, 0.5], [4.5, 4.5, 2.0], 'iron_metal')
c('hinge_pin_upper', [4.1, 14.5, 1.1], [4.4, 15.2, 1.4], 'iron_metal')
c('hinge_pin_lower', [4.1, 4.5, 1.1], [4.4, 5.2, 1.4], 'iron_metal')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'iron_metal': (32, 0, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/catacomb-arched-stone-corridor-doorframe, https://www.alamy.com/stock-photo/ancient-stone-passage-crypt.html',
    'used': 'ancient subterranean catacombs open-passage frame monumental walkthrough stone portal framing access between burial aisles with heavy ashlar jambs, molded reveals, worn threshold sill, molded cornice, and empty iron gate hinge pintles',
    'limitations': [
        'modular 20-unit wide walkthrough portal frame fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, iron_block pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('open_passage_frame', cs, a, regions, plan, area='catacombs')

checker(D, [0, 10.0, 0], [22, 22, 22])
views(D, [0, 10.0, 0], {
    'front': [0, 10.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 22, 26],
    'hinge_close': [4.0, 14.0, 6.0],
    'threshold_close': [0, 2.0, 7.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'open_passage_frame.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.save(D/'open_passage_frame_damp.png')
(D/'open_passage_frame_dry.png').write_bytes((D/'open_passage_frame.png').read_bytes())

call('create_texture', {'name': 'open_passage_frame_damp', 'data': str(D/'open_passage_frame_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'open_passage_frame_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 0], {
        'front_damp': [0, 10.0, 22],
        'three_quarter_damp': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('open_passage_frame', 'Open-passage frame', 'Empty niche', 'Skull niche', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['open_passage_frame.png', 'open_passage_frame_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'hinge_close.png', 'threshold_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Open-passage frame complete and verified with 100% full coverage!")
