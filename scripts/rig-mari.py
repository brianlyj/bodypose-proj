"""Create a webcam-ready derivative of the supplied static Mari GLB.
Run with Blender --background --factory-startup --python scripts/rig-mari.py.
The source file is preserved. All writes stay inside this project.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/Reference-mari.glb'
OUT = ROOT / 'public/avatars'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# The Sketchfab export uses unusually large coordinates. Normalize to a 2.25m
# stylized character; the halo extends above that. Blender coordinates are Z-up.
body = next(o for o in meshes if o.data.materials[0].name == 'Texture_0')
height = max((body.matrix_world @ v.co).z for v in body.data.vertices)
scale = 2.25 / height
for o in meshes:
    if o.data.materials[0].name == 'stage':
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    world = Matrix.Scale(scale, 4) @ o.matrix_world
    o.parent = None
    o.data.transform(world)
    o.matrix_world = Matrix.Identity(4)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in list(bpy.context.scene.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)

def smooth(a, b, x):
    t = max(0., min(1., (x-a)/(b-a)))
    return t*t*(3-2*t)

def components(o):
    parents = list(range(len(o.data.vertices)))
    def find(i):
        while parents[i] != i: parents[i] = parents[parents[i]]; i = parents[i]
        return i
    def union(a,b): parents[find(a)] = find(b)
    points = {}
    for v in o.data.vertices:
        k = tuple(round(x,5) for x in v.co)
        if k in points: union(v.index,points[k])
        else: points[k] = v.index
    for p in o.data.polygons:
        for i in p.vertices[1:]: union(p.vertices[0],i)
    groups = {}
    for v in o.data.vertices: groups.setdefault(find(v.index),[]).append(v.index)
    return list(groups.values())

arm = bpy.data.armatures.new('Mari humanoid skeleton')
rig = bpy.data.objects.new('MariRig',arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec = {
    'Root': ((0,0,0),(0,0,.12),None),
    'Hips': ((0,0,.82),(0,0,1.01),'Root'),
    'Spine': ((0,0,1.01),(0,0,1.15),'Hips'),
    'Chest': ((0,0,1.15),(0,0,1.29),'Spine'),
    'Neck': ((0,0,1.29),(0,0,1.39),'Chest'),
    'Head': ((0,0,1.39),(0,0,1.90),'Neck'),
}
for side,s in [('Left',1),('Right',-1)]:
    spec.update({
        side+'Shoulder': ((0,0,1.25),(s*.235,0,1.25),'Chest'),
        side+'UpperArm': ((s*.235,0,1.25),(s*.455,-.015,1.235),side+'Shoulder'),
        side+'LowerArm': ((s*.455,-.015,1.235),(s*.69,-.025,1.21),side+'UpperArm'),
        side+'Hand': ((s*.69,-.025,1.21),(s*.82,-.045,1.20),side+'LowerArm'),
        side+'UpperLeg': ((s*.135,0,.82),(s*.175,.015,.43),'Hips'),
        side+'LowerLeg': ((s*.175,.015,.43),(s*.19,0,.135),side+'UpperLeg'),
        side+'Foot': ((s*.19,0,.135),(s*.19,-.14,.06),side+'LowerLeg'),
    })
for name,(head,tail,parent) in spec.items():
    b=arm.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

def torso_weights(z):
    if z>1.30:
        t=smooth(1.30,1.39,z); return {'Neck':1-t,'Head':t}
    if z>1.13:
        t=smooth(1.13,1.26,z); return {'Spine':1-t,'Chest':t}
    t=smooth(.96,1.13,z); return {'Hips':1-t,'Spine':t}

def weights(p,kind):
    x,y,z=p; side='Left' if x>0 else 'Right'; ax=abs(x)
    if kind=='head': return {'Head':1}
    if kind=='skirt': return {'Hips':1}
    if kind=='arm' or (ax>.225 and 1.125<z<1.32 and y<.16):
        if ax<.29:
            t=smooth(.22,.29,ax); return {'Chest':1-t,side+'UpperArm':t}
        if ax<.61:
            t=smooth(.405,.505,ax); return {side+'UpperArm':1-t,side+'LowerArm':t}
        t=smooth(.645,.715,ax); return {side+'LowerArm':1-t,side+'Hand':t}
    if z<.68 and ax<.30 and -.2<y<.14:
        if z<.20:
            t=smooth(.115,.20,z); return {side+'Foot':1-t,side+'LowerLeg':t}
        t=smooth(.37,.49,z); return {side+'LowerLeg':1-t,side+'UpperLeg':t}
    return torso_weights(z)

inventory=[]
for o in meshes:
    material=o.data.materials[0].name
    groups={n:o.vertex_groups.new(name=n) for n in spec}
    for ids in components(o):
        pts=[o.data.vertices[i].co for i in ids]
        lo=[min(v[i] for v in pts) for i in range(3)]
        hi=[max(v[i] for v in pts) for i in range(3)]
        kind='body'
        if material in ('material','eye_brow','face','hair','halo','mouth') or o.name=='Object_12' or lo[2]>1.34: kind='head'
        elif hi[2]<1.05 and (hi[1]>.3 or (hi[0]-lo[0]>.6 and len(ids)<1000)): kind='skirt'
        elif lo[2]>1.12 and hi[2]<1.33 and (lo[0]>.4 or hi[0]<-.4): kind='arm'
        for i in ids:
            for name,w in weights(o.data.vertices[i].co,kind).items():
                if w>0: groups[name].add([i],w,'REPLACE')
    o.parent=rig
    mod=o.modifiers.new('Mari skin','ARMATURE'); mod.object=rig
    inventory.append({'mesh':o.name,'material':material,'vertices':len(o.data.vertices)})

# Expression targets operate on the original textured geometry. Close both the
# eye insert and the surrounding face opening to avoid hollow eye sockets.
for o in meshes:
    mat=o.data.materials[0].name
    if mat not in ('material','face','eye_brow','mouth','outline'): continue
    if o.name=='Object_12': continue
    o.shape_key_add(name='Basis')
    for side,sign in [('Left',1),('Right',-1)]:
        if mat in ('material','face','outline'):
            key=o.shape_key_add(name='eyeBlink'+side)
            for base,dest in zip(o.data.vertices,key.data):
                x,y,z=base.co
                if x*sign<=0: continue
                if mat=='material': w=1.
                else:
                    w=smooth(.018,.052,abs(x))*(1-smooth(.19,.242,abs(x)))
                    w*=smooth(1.42,1.465,z)*(1-smooth(1.605,1.67,z))*(1-smooth(-.12,-.07,y))
                dest.co.z=z+w*(1.532+(z-1.532)*.035-z)
        if mat=='eye_brow':
            key=o.shape_key_add(name='browOuterUp'+side)
            for base,dest in zip(o.data.vertices,key.data):
                if base.co.x*sign>0: dest.co.z+=.035
    if mat=='eye_brow':
        key=o.shape_key_add(name='browInnerUp')
        for base,dest in zip(o.data.vertices,key.data): dest.co.z+=.045*(1-smooth(.03,.21,abs(base.co.x)))
    if mat=='mouth':
        key=o.shape_key_add(name='jawOpen')
        for base,dest in zip(o.data.vertices,key.data):
            dest.co.x*=.7;dest.co.y+=.025
        for side,sign in [('Left',1),('Right',-1)]:
            key=o.shape_key_add(name='mouthSmile'+side)
            for base,dest in zip(o.data.vertices,key.data):
                if base.co.x*sign>0:
                    dest.co.x*=1.2;dest.co.z+=.015*smooth(0,.07,abs(base.co.x))

# Add an animated mouth cavity and tongue because the supplied smile is a flat
# transparent texture, with no interior surface to reveal when the jaw opens.
for name,color,cx,cz,rx,rz in [('MouthInterior',(.13,.025,.04,1),0,1.393,.043,.042),('Tongue',(.8,.18,.28,1),0,1.375,.029,.013)]:
    center=Vector((cx,-.246 if name=='MouthInterior' else -.247,cz))
    mesh=bpy.data.meshes.new(name)
    verts=[tuple(center) for _ in range(33)]
    faces=[(0,i+1,(i+1)%32+1) for i in range(32)]
    mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=rig
    m=bpy.data.materials.new(name);m.use_nodes=True
    nodes=m.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');em=nodes.new('ShaderNodeEmission');em.inputs[0].default_value=color;m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
    mesh.materials.append(m)
    o.vertex_groups.new(name='Head').add(list(range(33)),1,'REPLACE')
    mod=o.modifiers.new('Mari skin','ARMATURE');mod.object=rig
    o.shape_key_add(name='Basis');key=o.shape_key_add(name='jawOpen')
    for i in range(32):
        a=i*math.tau/32;key.data[i+1].co=center+Vector((math.cos(a)*rx,0,math.sin(a)*rz))

rig['source_credit']='VückyZ / Sketchfab — CC BY 4.0'
rig['rig_notes']='Body skin weights and simplified webcam expression targets added for Afterimage. No finger articulation or cloth simulation.'
bpy.context.scene['source_asset']=str(SOURCE.name)
bpy.context.scene['tracking_coordinate_system']='Exported glTF: Y up, character faces +Z; Left bones are +X.'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in bpy.context.scene.objects:
    if o.type=='MESH': o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/Mari-webcam-rig.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'Mari-rigged.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_morph=True,export_extras=True)
report={'source':str(SOURCE),'output':str(OUT/'Mari-rigged.glb'),'bones':list(spec),'meshes':inventory,'shapeKeys':{o.name:[k.name for k in o.data.shape_keys.key_blocks] for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys}}
(ROOT/'assets/rig-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('MARI_RIG_EXPORTED',json.dumps({'bones':len(spec),'meshes':len(inventory),'output':str(OUT/'Mari-rigged.glb')}))
