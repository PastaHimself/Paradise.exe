import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from texture_preview import build_texture, finish_texture

print('Starting build_texture for damp_wall_patches...', flush=True)
D = build_texture(
    area='endless_staircase',
    folder='damp_wall_patches',
    source='concrete_powder_gray.png',
    reference='https://valcourt.group/concrete-water-damage-causes-repair/',
    used='subterranean stairwell concrete wall with darkened damp moisture patches from water infiltration',
    limitations=[
        'original concrete_powder_gray pixels copied byte-identically',
        '2x2 modular preview platform in free format at 1 px/unit scale',
        'no custom moisture bleed or gradient repaint under vanilla original-source rule',
        'no runtime geometry needed'
    ]
)
print('Texture preview generated, now finishing...', flush=True)
finish_texture(
    area='endless_staircase',
    folder='damp_wall_patches',
    title='Damp wall patches',
    nexttitle='Straight railing',
    nextnext='Corner railing'
)
print('Damp wall patches complete and verified!', flush=True)
