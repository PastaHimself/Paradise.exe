import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from views import views

D = ROOT / 'paradise_exe_v2' / 'burning_highway' / 'guardrail_end'

checker(D, [0, 6, 0], [20, 16, -18])
views(D, [0, 6, 0], {
    'front': [0, 8, -24],
    'three_quarter': [20, 16, -18],
    'back': [-20, 16, 22],
    'gameplay_scale': [32, 24, -28],
    'impact_head': [8, 8, 8]
})

finish('guardrail_end', 'Guardrail end', 'Traffic cone', 'Striped roadwork barricade', area='burning_highway')
print('Guardrail end finished successfully!', flush=True)
