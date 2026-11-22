from pipeline import *
from checker import checker
from glyphs import lettering
import sys
number=sys.argv[1];folder='shelf_number_plate_'+number
cs=[{'name':'plate','from':[-3,0,7.875],'to':[3,3,8]}];a={'plate':('backing',[],False)}
lettering(cs,a,number,.375,.5625,7.875)
D=build(folder,cs,a,{'backing':(0,0,'quartz_block_side.png'),'ink':(16,0,'concrete_black.png')},{'reference':'https://libraryguides.cobleskill.edu/c.php?g=557796&p=3836053','used':'small flat shelf-end placard mounted flush to end panel, high contrast identifier','limitations':['identifier '+number+' formed by geometry using original black material','place back surface z=8 against shelf end','no Dewey ranges or pack bindings']})
checker(D,[0,1.5,8],[10,7,-6]);views(D,[0,1.5,8],{'front':[0,5,-7],'three_quarter':[10,7,-6],'back':[-10,6,22],'gameplay_scale':[22,15,-22]});print('Shelf '+number+' ready')
