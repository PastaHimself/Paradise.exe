with open('paradise_exe_v2/production_tools/test_emergency_exit.py') as f:
    text = f.read()

# Update stringers and bolts to Y=14.0 and Y=6.6
old_str = """# 5. Horizontal Backing Channels
for name, y1, y2 in [('str_top', 13.0, 13.9), ('str_bot', 7.1, 8.0)]:
    c(f'{name}_l', [-7.5, y1, -0.45], [-5.6, y2, 0.0], 'steel', off=['south', 'east'])
    c(f'{name}_mid', [-5.0, y1, -0.45], [5.0, y2, 0.0], 'steel', off=['south', 'west', 'east'])
    c(f'{name}_r', [5.6, y1, -0.45], [7.5, y2, 0.0], 'steel', off=['south', 'west'])

# 6. Mounting Hardware Bolts (on sign face at Z: 0.4 to 0.6)
c('bolt_tl', [-5.5, 13.2, 0.4], [-5.1, 13.7, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [5.1, 13.2, 0.4], [5.5, 13.7, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-5.5, 7.3, 0.4], [-5.1, 7.8, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [5.1, 7.3, 0.4], [5.5, 7.8, 0.6], 'dark_metal', off=['north'])"""

new_str = """# 5. Horizontal Backing Channels
for name, y1, y2 in [('str_top', 13.7, 14.6), ('str_bot', 6.4, 7.2)]:
    c(f'{name}_l', [-7.5, y1, -0.45], [-5.6, y2, 0.0], 'steel', off=['south', 'east'])
    c(f'{name}_mid', [-5.0, y1, -0.45], [5.0, y2, 0.0], 'steel', off=['south', 'west', 'east'])
    c(f'{name}_r', [5.6, y1, -0.45], [7.5, y2, 0.0], 'steel', off=['south', 'west'])

# 6. Mounting Hardware Bolts (on sign face at Z: 0.4 to 0.6)
c('bolt_tl', [-5.5, 13.9, 0.4], [-5.1, 14.4, 0.6], 'dark_metal', off=['north'])
c('bolt_tr', [5.1, 13.9, 0.4], [5.5, 14.4, 0.6], 'dark_metal', off=['north'])
c('bolt_bl', [-5.5, 6.5, 0.4], [-5.1, 7.0, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [5.1, 6.5, 0.4], [5.5, 7.0, 0.6], 'dark_metal', off=['north'])"""

text = text.replace(old_str, new_str)

with open('paradise_exe_v2/production_tools/test_emergency_exit.py', 'w') as f:
    f.write(text)
