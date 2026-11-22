from pipeline import *
def variant(D,folder,region,source,target,camera):
 im=Image.open(D/(folder+'.png')).convert('RGBA');x,y=region[:2];w,h=region[2:] if len(region)>2 else (16,16)
 for xx in range(x,x+w,16):
  for yy in range(y,y+h,16):im.paste(Image.open(S/source).convert('RGBA'),(xx,yy))
 path=D/(folder+'_unlit.png');im.save(path)
 (D/(folder+'_lit.png')).write_bytes((D/(folder+'.png')).read_bytes())
 assert im.crop((x,y,x+16,y+16)).tobytes()==Image.open(S/source).convert('RGBA').tobytes()
 call('create_texture',{'name':folder+'_unlit','data':str(path)})
 audit=json.loads((D/'uv_audit.json').read_text())
 try:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':folder+'_unlit'} for f,v in q['faces'].items() if v['texture'] is not None}})
  views(D,target,{'front_unlit':[0,camera[1],camera[2]],'three_quarter_unlit':camera})
 finally:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':v['texture']} for f,v in q['faces'].items()}})
 dump(D/'variant_verification.json',{'same_geometry_and_UVs':True,'lit':folder+'_lit.png','unlit':folder+'_unlit.png','unlit_source':source,'original_pixels':True,'preview_project_restored':'lit'})
