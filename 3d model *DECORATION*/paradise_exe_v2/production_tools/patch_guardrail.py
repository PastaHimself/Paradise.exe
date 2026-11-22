with open('paradise_exe_v2/production_tools/build_guardrail_end.py') as f:
    text = f.read()

text = text.replace("c('cable_bracket', [-1.8, 6.5, -1.2], [-0.6, 9.5, -0.75], 'dark_metal', off=['south'])",
                    "c('cable_bracket', [-1.8, 6.5, -1.2], [-0.6, 9.5, -0.75], 'dark_metal', off=['south', 'east'])")

text = text.replace("c('cable_stud',    [-0.6, 7.2, -1.1], [0.0, 8.0, -0.85], 'dark_metal')",
                    "c('cable_stud',    [-0.6, 7.2, -1.1], [0.0, 8.0, -0.85], 'dark_metal', off=['west'])")

text = text.replace("c('cable_seg3',    [1.25, 1.8, -2.25], [1.8, 3.8, -1.85], 'dark_metal')",
                    "c('cable_seg3',    [1.25, 1.8, -2.25], [1.78, 3.8, -1.85], 'dark_metal', off=['down'])")

text = text.replace("c('cable_nut',     [1.55, 1.2, -2.4], [1.8, 1.8, -2.0], 'dark_metal', off=['east'])",
                    "c('cable_nut',     [1.55, 1.2, -2.4], [1.78, 1.8, -2.0], 'dark_metal', off=['up'])")

with open('paradise_exe_v2/production_tools/build_guardrail_end.py', 'w') as f:
    f.write(text)
