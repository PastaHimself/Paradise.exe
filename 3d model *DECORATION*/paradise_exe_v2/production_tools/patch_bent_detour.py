with open('paradise_exe_v2/production_tools/test_bent_detour_sign.py') as f:
    text = f.read()

# Fix 1: cull south on post_l_upper
text = text.replace("c('post_l_upper',[-4.6, 5.2, -1.6], [-4.0, 11.2, -1.0], 'steel', off=['down'])",
                    "c('post_l_upper',[-4.6, 5.2, -1.6], [-4.0, 11.2, -1.0], 'steel', off=['down', 'south'])")

# Fix 2: shift DET to left (-5.5 instead of -5.2)
text = text.replace("sign_lettering_part(cs, a, 'DET', 0.42, 8.9, -0.6, -5.2, depth=0.08, material='ink', prefix='let_l')",
                    "sign_lettering_part(cs, a, 'DET', 0.42, 8.9, -0.6, -5.5, depth=0.08, material='ink', prefix='let_l')")

# Fix 3: cull south on post_r_lower
text = text.replace("c('post_r_lower', [4.0, 0.0, -0.6], [4.6, 5.5, 0.0], 'steel', off=['down', 'up'])",
                    "c('post_r_lower', [4.0, 0.0, -0.6], [4.6, 5.5, 0.0], 'steel', off=['down', 'up', 'south'])")

# Fix 4: post_r_upper Z at [-0.6, 0.0]
text = text.replace("c('post_r_upper', [3.9, 5.5, -0.4], [4.5, 13.0, 0.2], 'steel', off=['down'])",
                    "c('post_r_upper', [3.9, 5.5, -0.6], [4.5, 13.0, 0.0], 'steel', off=['down', 'south'])")

with open('paradise_exe_v2/production_tools/test_bent_detour_sign.py', 'w') as f:
    f.write(text)
