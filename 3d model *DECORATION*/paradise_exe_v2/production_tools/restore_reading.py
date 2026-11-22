from mcp import *
D=ROOT/'paradise_exe_v2/library/reading_room_sign';assert call('get_project_info',{})['project']['name']=='library_reading_room_sign'
audit=json.loads((D/'uv_audit.json').read_text())
for n,q in enumerate(audit):
 call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':v['texture']} for f,v in q['faces'].items()}})
 if n%10==0:print('restored',n+1,flush=True)
tex=call('list_textures',{})
for t in tex:
 if t['name']=='__qa_checker':call('delete_texture',{'texture':t['uuid']})
print('Original assignments restored',flush=True)
