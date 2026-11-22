import json, subprocess, base64, io, pathlib
from PIL import Image

ROOT = pathlib.Path('/home/pasta/Downloads/blockbench')
S = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
D = ROOT / 'paradise_exe_v2/flat_flower/low_stone_border'
folder = 'low_stone_border'
stem = 'flat_flower_low_stone_border'

from mcp import call, dump
from views import views
from checker import checker

# 1. Clear elements in the currently loaded project
call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); return {elements: Project.elements.length, textures: Project.textures.length}; })()'})

# 2. Define the reworked cubes with flush joins, zero z-fighting, zero gaps
cs = [
    {'name': 'stone_sett_0', 'from': [-8, 0, -2.0], 'to': [-4, 3.25, 2.0]},
    {'name': 'stone_sett_1', 'from': [-4, 0, -2.25], 'to': [0, 3.5, 2.0]},
    {'name': 'stone_sett_2', 'from': [0, 0, -1.75], 'to': [4, 3.0, 2.0]},
    {'name': 'stone_sett_3', 'from': [4, 0, -2.0], 'to': [8, 3.25, 2.0]},
    {'name': 'retained_soil', 'from': [-8, 0, 2.0], 'to': [8, 1.5, 6.0]},
    {'name': 'weathered_chip', 'from': [1, 0, -3.25], 'to': [3, 0.75, -2.0]}
]

dump(D / 'build_elements.json', cs)
call('place_cube', {'elements': cs, 'faces': False})

# 3. Build texture atlas (64x64): stonebrick at (0,0), dirt at (16,0)
im = Image.new('RGBA', (64, 64))
im.paste(Image.open(S / 'stonebrick.png').convert('RGBA'), (0, 0))
im.paste(Image.open(S / 'dirt.png').convert('RGBA'), (16, 0))
im.save(D / (folder + '.png'))
call('create_texture', {'name': folder, 'data': str(D / (folder + '.png'))})

# 4. Map face-specific UVs with continuous, non-repeating span across the stones
# 1 pixel per model unit: divide pixel coordinate by 4 for UV
# Sett 0: U in pixels [0, 4] -> UV [0.0, 1.0]
# Sett 1: U in pixels [4, 8] -> UV [1.0, 2.0]
# Sett 2: U in pixels [8, 12] -> UV [2.0, 3.0]
# Sett 3: U in pixels [12, 16] -> UV [3.0, 4.0]
# Retained soil: U in pixels [16, 32] -> UV [4.0, 8.0]

uv_map = {
    'stone_sett_0': {
        'north': {'uv': [0.0, 0.0, 1.0, 0.8125], 'texture': folder},
        'south': {'uv': [0.0, 0.0, 1.0, 0.8125], 'texture': folder},
        'east': {'uv': [0.0, 0.0, 1.0, 0.8125], 'texture': folder},
        'west': {'uv': [0.0, 0.0, 1.0, 0.8125], 'texture': folder},
        'up': {'uv': [0.0, 0.0, 1.0, 1.0], 'texture': folder},
        'down': {'texture': None}
    },
    'stone_sett_1': {
        'north': {'uv': [1.0, 0.0, 2.0, 0.875], 'texture': folder},
        'south': {'uv': [1.0, 0.0, 2.0, 0.875], 'texture': folder},
        'east': {'uv': [1.0, 0.0, 2.0625, 0.875], 'texture': folder},
        'west': {'uv': [1.0, 0.0, 2.0625, 0.875], 'texture': folder},
        'up': {'uv': [1.0, 0.0, 2.0, 1.0625], 'texture': folder},
        'down': {'texture': None}
    },
    'stone_sett_2': {
        'north': {'uv': [2.0, 0.0, 3.0, 0.75], 'texture': folder},
        'south': {'uv': [2.0, 0.0, 3.0, 0.75], 'texture': folder},
        'east': {'uv': [2.0, 0.0, 2.9375, 0.75], 'texture': folder},
        'west': {'uv': [2.0, 0.0, 2.9375, 0.75], 'texture': folder},
        'up': {'uv': [2.0, 0.0, 3.0, 0.9375], 'texture': folder},
        'down': {'texture': None}
    },
    'stone_sett_3': {
        'north': {'uv': [3.0, 0.0, 4.0, 0.8125], 'texture': folder},
        'south': {'uv': [3.0, 0.0, 4.0, 0.8125], 'texture': folder},
        'east': {'uv': [3.0, 0.0, 4.0, 0.8125], 'texture': folder},
        'west': {'uv': [3.0, 0.0, 4.0, 0.8125], 'texture': folder},
        'up': {'uv': [3.0, 0.0, 4.0, 1.0], 'texture': folder},
        'down': {'texture': None}
    },
    'retained_soil': {
        'north': {'uv': [4.0, 0.0, 8.0, 0.375], 'texture': folder},
        'south': {'uv': [4.0, 0.0, 8.0, 0.375], 'texture': folder},
        'east': {'uv': [4.0, 0.0, 5.0, 0.375], 'texture': folder},
        'west': {'uv': [4.0, 0.0, 5.0, 0.375], 'texture': folder},
        'up': {'uv': [4.0, 0.0, 8.0, 1.0], 'texture': folder},
        'down': {'texture': None}
    },
    'weathered_chip': {
        'north': {'uv': [2.0, 0.0, 2.5, 0.1875], 'texture': folder},
        'south': {'uv': [2.0, 0.0, 2.5, 0.1875], 'texture': folder},
        'east': {'uv': [2.0, 0.0, 2.3125, 0.1875], 'texture': folder},
        'west': {'uv': [2.0, 0.0, 2.3125, 0.1875], 'texture': folder},
        'up': {'uv': [2.0, 0.0, 2.5, 0.3125], 'texture': folder},
        'down': {'texture': None}
    }
}

for name, faces in uv_map.items():
    call('set_cube_uv', {'id': name, 'box_uv': False, 'faces': faces})

dump(D / 'uv_audit.json', [call('get_cube_uv', {'id': q['name']}) for q in cs])

# 5. Run QA checker and render viewpoints
checker(D, [0, 1.75, 0], [24, 20, -26])
views(D, [0, 1.75, 0], {
    'front': [0, 16, -32],
    'three_quarter': [22, 18, -24],
    'back': [-22, 18, 24],
    'gameplay_scale': [36, 28, -42],
    'top': [0, 36, -1]
})

print('Rework completed successfully', flush=True)
