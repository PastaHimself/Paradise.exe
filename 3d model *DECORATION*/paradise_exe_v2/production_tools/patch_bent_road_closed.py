with open('paradise_exe_v2/production_tools/test_bent_road_closed.py') as f:
    text = f.read()

# Fix 1: shift CLO to -4.8
text = text.replace("sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -5.4, depth=0.08, material='ink', prefix='let_clo')",
                    "sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -4.8, depth=0.08, material='ink', prefix='let_clo')")

# Fix 2: mount stringers behind posts
text = text.replace("c('str_l_top', [-7.5, 12.6, -1.2], [-0.4, 13.6, -0.8], 'steel', off=['south'])",
                    "c('str_l_top', [-7.5, 12.6, -1.8], [-0.4, 13.6, -1.4], 'steel', off=['south'])")
text = text.replace("c('str_l_bot', [-7.5, 6.2, -1.2], [-0.4, 7.2, -0.8], 'steel', off=['south'])",
                    "c('str_l_bot', [-7.5, 6.2, -1.8], [-0.4, 7.2, -1.4], 'steel', off=['south'])")

text = text.replace("c('str_r_top', [0.4, 13.2, -0.2], [7.5, 14.2, 0.2], 'steel', off=['south'])",
                    "c('str_r_top', [0.4, 13.2, -0.8], [7.5, 14.2, -0.4], 'steel', off=['south'])")
text = text.replace("c('str_r_bot', [0.4, 6.8, -0.2], [7.5, 7.8, 0.2], 'steel', off=['south'])",
                    "c('str_r_bot', [0.4, 6.8, -0.8], [7.5, 7.8, -0.4], 'steel', off=['south'])")

with open('paradise_exe_v2/production_tools/test_bent_road_closed.py', 'w') as f:
    f.write(text)
