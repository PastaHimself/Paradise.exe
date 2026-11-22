with open('paradise_exe_v2/production_tools/test_barricade_full.py') as f:
    text = f.read()

text = text.replace("c('sandbag_l', [-6.4, 0.2, 1.2], [-4.6, 1.5, 3.6], 'sandbag')",
                    "c('sandbag_l', [-6.4, 0.6, 1.2], [-4.6, 1.9, 3.6], 'sandbag', off=['down'])")

text = text.replace("c('sandbag_r', [4.6, 0.2, -3.6], [6.4, 1.5, -1.2], 'sandbag')",
                    "c('sandbag_r', [4.6, 0.6, -3.6], [6.4, 1.9, -1.2], 'sandbag', off=['down'])")

with open('paradise_exe_v2/production_tools/test_barricade_full.py', 'w') as f:
    f.write(text)
