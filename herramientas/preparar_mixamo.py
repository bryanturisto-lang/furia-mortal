"""Prepara un modelo GLB (de Hunyuan3D/TRELLIS) para subirlo a Mixamo.

1. Convierte el GLB a OBJ con su textura.
2. Quita piezas sueltas muy pequeñas (brasas flotantes) que confunden al auto-rig.
3. Reduce los polígonos conservando la textura (apto para teléfono).
4. Empaqueta OBJ + MTL + textura en un .zip, que es lo que acepta Mixamo.

Uso: py preparar_mixamo.py <modelo.glb> [caras_objetivo]
"""
import os
import sys
import zipfile

import pymeshlab
import trimesh

glb = os.path.abspath(sys.argv[1])
target = int(sys.argv[2]) if len(sys.argv) > 2 else 25000
base = os.path.splitext(glb)[0]
work = base + '_mixamo'
os.makedirs(work, exist_ok=True)
name = os.path.basename(base)

# 1) GLB -> OBJ con textura
scene = trimesh.load(glb, force='scene')
mesh = scene.to_geometry() if hasattr(scene, 'to_geometry') else scene.dump(concatenate=True)
raw_obj = os.path.join(work, f'{name}_crudo.obj')
mesh.export(raw_obj)
print('caras originales:', len(mesh.faces))

# 2) y 3) limpiar y reducir con MeshLab conservando las coordenadas de textura
ms = pymeshlab.MeshSet()
ms.load_new_mesh(raw_obj)
diag = ms.current_mesh().bounding_box().diagonal()

def piezas():
    return ms.get_topological_measures()['connected_components_number']

# soldar vértices duplicados (el GLB los separa en cada borde de textura y Mixamo necesita un cuerpo continuo)
print('piezas antes de soldar:', piezas())
ms.meshing_merge_close_vertices(threshold=pymeshlab.PercentageValue(0.05))
ms.meshing_remove_duplicate_faces()
ms.meshing_remove_unreferenced_vertices()
print('piezas después de soldar:', piezas())
ms.meshing_remove_connected_component_by_diameter(mincomponentdiag=pymeshlab.PercentageValue(4))
print('caras sin piezas sueltas:', ms.current_mesh().face_number(), '· piezas:', piezas(), f'(diagonal {diag:.3f})')
ms.meshing_decimation_quadric_edge_collapse_with_texture(targetfacenum=target, preserveboundary=True, optimalplacement=True)
print('caras reducidas:', ms.current_mesh().face_number())
final_obj = os.path.join(work, f'{name}.obj')
ms.save_current_mesh(final_obj, save_textures=True)

# 4) zip con OBJ + MTL + texturas (sin el archivo crudo)
zip_path = base + '_para_mixamo.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir(work):
        if '_crudo' in f:
            continue
        z.write(os.path.join(work, f), f)
        print('  zip:', f)
print('LISTO ->', zip_path, f'{os.path.getsize(zip_path) / 1e6:.1f} MB')
