with open('paradise_exe_v2/production_tools/test_road_closed_sign.py') as f:
    text = f.read()

old_str = """# 5. Horizontal Backing Channels
c('stringer_top', [-7.5, 13.2, -0.5], [7.5, 14.2, 0.0], 'steel', off=['south', 'west', 'east'])
c('stringer_bot', [-7.5, 6.8, -0.5], [7.5, 7.8, 0.0], 'steel', off=['south', 'west', 'east'])"""

new_str = """# 5. Horizontal Backing Channels (3 segments per stringer, mounting flush to posts)
for name, y1, y2 in [('str_top', 13.2, 14.2), ('str_bot', 6.8, 7.8)]:
    c(f'{name}_l', [-7.5, y1, -0.45], [-5.6, y2, 0.0], 'steel', off=['south', 'east'])
    c(f'{name}_mid', [-5.0, y1, -0.45], [5.0, y2, 0.0], 'steel', off=['south', 'west', 'east'])
    c(f'{name}_r', [5.6, y1, -0.45], [7.5, y2, 0.0], 'steel', off=['south', 'west'])"""

text = text.replace(old_str, new_str)

with open('paradise_exe_v2/production_tools/test_road_closed_sign.py', 'w') as f:
    f.write(text)
