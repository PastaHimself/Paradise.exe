from mcp import *
from PIL import Image
import io,uuid

def views(D,target,positions,format='png'):
 view='qa_'+uuid.uuid4().hex[:10]
 call('create_offscreen_view',{'id':view,'width':640,'height':480,'antialias':False,'copy_view':'none'})
 try:
  for n,pos in positions.items():
   call('set_camera_angle',{'view':view,'position':pos,'target':target,'projection':'perspective','fov':40,'max_size':640,'format':format})
   r=call('capture_screenshot',{'view':view,'max_size':640,'format':format})
   raw=base64.b64decode(next(c['data'] for c in r['content'] if c.get('type')=='image'));im=Image.open(io.BytesIO(raw))
   if im.convert('RGB').getbbox() is None:
    r=call('capture_screenshot',{'view':view,'max_size':640,'format':format});raw=base64.b64decode(next(c['data'] for c in r['content'] if c.get('type')=='image'));im=Image.open(io.BytesIO(raw))
   assert im.convert('RGB').getbbox() is not None,'Empty viewport capture: '+n
   (D/(n+('.jpg' if format=='jpeg' else '.png'))).write_bytes(raw)
 finally:
  listed=call('list_views',{})['views']
  if any(v['id']==view for v in listed):
   try:call('delete_offscreen_view',{'view':view})
   except RuntimeError as e:
    if not any(v in str(e) for v in ['Unknown offscreen view','onContextMenu is not defined']):raise
    assert not any(v['id']==view for v in call('list_views',{})['views'])
