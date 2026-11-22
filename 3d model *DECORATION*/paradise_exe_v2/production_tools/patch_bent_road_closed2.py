with open('paradise_exe_v2/production_tools/test_bent_road_closed.py') as f:
    text = f.read()

text = text.replace("sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -4.8, depth=0.08, material='ink', prefix='let_clo')",
                    "sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -5.1, depth=0.08, material='ink', prefix='let_clo')")

text = text.replace("c('bolt_bl', [-5.5, 6.5, -0.4], [-5.1, 6.9, -0.2], 'dark_metal', off=['north'])",
                    "c('bolt_bl', [-5.8, 6.5, -0.4], [-5.4, 6.9, -0.2], 'dark_metal', off=['north'])")

with open('paradise_exe_v2/production_tools/test_bent_road_closed.py', 'w') as f:
    f.write(text)
