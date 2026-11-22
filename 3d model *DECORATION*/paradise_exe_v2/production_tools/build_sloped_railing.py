import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m, off=[], rot=False, origin=None, rotation=None):
    cube = {'name': n, 'from': lo, 'to': hi}
    if origin is not None:
        cube['origin'] = origin
    if rotation is not None:
        cube['rotation'] = rotation
    cs.append(cube)
    a[n] = (m, off, rot)

# 1. Lower stair tread footing & stanchion (tread surface at Y = 0, X centered at -4.0)
c('flange_low', [-5.5, 0.0, -1.5], [-2.5, 0.5, 1.5], 'steel', off=['down'])
c('post_low', [-4.75, 0.5, -0.75], [-3.25, 12.75, 0.75], 'steel', off=['down', 'up'])

# 2. Upper stair tread footing & stanchion (tread surface at Y = 8.0, X centered at +4.0)
c('flange_high', [2.5, 8.0, -1.5], [5.5, 8.5, 1.5], 'steel', off=['down'])
c('post_high', [3.25, 8.5, -0.75], [4.75, 20.75, 0.75], 'steel', off=['down', 'up'])

# 3. Industrial Kee Klamp swivel collar fittings on top rail over posts
c('collar_low', [-6.66, 16.9, -0.9], [-4.66, 19.1, 0.9], 'steel', off=[],
  origin=[0, 18.0, 0], rotation=[0, 0, 45])
c('collar_high', [4.66, 16.9, -0.9], [6.66, 19.1, 0.9], 'steel', off=[],
  origin=[0, 18.0, 0], rotation=[0, 0, 45])

# 4. 45-degree sloped continuous top safety handrail (ascends 16 units over 16-unit span)
c('top_rail', [-11.3137, 17.25, -0.75], [11.3137, 18.75, 0.75], 'yellow', off=[],
  origin=[0, 18.0, 0], rotation=[0, 0, 45])

# 5. 45-degree sloped continuous mid safety rail (8 units below top rail)
c('mid_rail', [-11.3137, 9.5, -0.5], [11.3137, 10.5, 0.5], 'steel', off=[],
  origin=[0, 10.0, 0], rotation=[0, 0, 45])

# 6. Base anchor bolts (4 per flange, 0.5x0.5, height 0.25)
for name, cx, cy in [('low', -4.0, 0.5), ('high', 4.0, 8.5)]:
    for i, (bx, bz) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
        c(f'bolt_{name}_{i}', [cx + bx - 0.25, cy, bz - 0.25], [cx + bx + 0.25, cy + 0.25, bz + 0.25], 'dark_metal', off=['down'])

print(f'Configured {len(cs)} elements for sloped railing.')

# Regions: width 32 to tile vanilla 16x16 texture seamlessly over 22.6-unit rail length
regions = {
    'steel': (0, 0, 'iron_block.png', 32, 16),
    'yellow': (32, 0, 'concrete_yellow.png', 32, 16),
    'dark_metal': (0, 16, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.safesitefacilities.co.uk/knowledge-base/guidelines-for-staircase-handrails',
    'used': 'commercial industrial stairwell 45-degree sloped tubular guardrail with twin stanchions mounted to lower and upper stair treads, swivel collar fittings, continuous safety yellow handrail, and bolted flanges',
    'limitations': [
        '16x16 modular sloped railing unit with 45-degree pitch matching 16-unit Minecraft stair rise and run',
        'swivel collar joints conceal angled stanchion intersections with 0 coplanar z-fighting',
        'original iron_block, concrete_yellow, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('sloped_railing', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 13, 0], [24, 22, -26])
views(D, [0, 13, 0], {
    'front': [0, 14, -36],
    'three_quarter': [24, 22, -26],
    'back': [-24, 18, 28],
    'gameplay_scale': [38, 30, -42],
    'collar_close': [4, 18, -6]
})
print('Sloped railing build complete.', flush=True)
