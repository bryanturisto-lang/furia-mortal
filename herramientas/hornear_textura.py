"""Reduce un modelo y "hornea" su textura sobre la versión reducida.

1. Carga el OBJ soldado con textura (alta resolución).
2. Hace una copia y la reduce a N caras (sin respetar las costuras de textura).
3. Le crea coordenadas de textura nuevas y traspasa los colores del original.
4. Guarda OBJ + MTL + textura nueva y los empaqueta en un .zip para Mixamo.

Uso: py hornear_textura.py <origen.obj> <carpeta_salida> <nombre> [caras] [lado_textura]
"""
import os
import sys
import zipfile

import pymeshlab

src, out_dir, name = sys.argv[1], sys.argv[2], sys.argv[3]
faces = int(sys.argv[4]) if len(sys.argv) > 4 else 30000
side = int(sys.argv[5]) if len(sys.argv) > 5 else 4096
os.makedirs(out_dir, exist_ok=True)

ms = pymeshlab.MeshSet()
ms.load_new_mesh(src)                      # malla 0: original con textura
ms.generate_copy_of_current_mesh()         # malla 1: copia que vamos a reducir
ms.set_current_mesh(1)
ms.meshing_decimation_quadric_edge_collapse(targetfacenum=faces, preserveboundary=True, preservenormal=True,
                                            optimalplacement=True, planarquadric=True, autoclean=True)
ms.meshing_remove_connected_component_by_diameter(mincomponentdiag=pymeshlab.PercentageValue(3))
m = ms.current_mesh()
print('caras reducidas:', m.face_number(), '· piezas:', ms.get_topological_measures()['connected_components_number'])

# coordenadas de textura nuevas y traspaso de colores desde la malla original
ms.compute_texcoord_parametrization_triangle_trivial_per_wedge(textdim=side, border=2)
tex = f'{name}_tex.png'
ms.transfer_attributes_to_texture_per_vertex(sourcemesh=0, targetmesh=1, attributeenum='Texture Color',
                                             textname=tex, textw=side, texth=side, overwrite=False, pullpush=True)

obj = os.path.join(out_dir, f'{name}.obj')
ms.save_current_mesh(obj, save_textures=True, save_vertex_normal=False)
# el PNG se guarda junto al OBJ de origen o de destino según la versión; asegurar que esté en out_dir
for cand in (os.path.join(out_dir, tex), os.path.join(os.path.dirname(src), tex), os.path.join(os.getcwd(), tex)):
    if os.path.exists(cand) and os.path.dirname(os.path.abspath(cand)) != os.path.abspath(out_dir):
        os.replace(cand, os.path.join(out_dir, tex))

# textura liviana: JPG de 2048 px (y el MTL apuntando a ella)
from PIL import Image
png_path = os.path.join(out_dir, tex)
jpg = f'{name}_tex.jpg'
Image.open(png_path).convert('RGB').resize((2048, 2048), Image.LANCZOS).save(os.path.join(out_dir, jpg), quality=88)
os.remove(png_path)
mtl = obj + '.mtl'
open(mtl, 'w', encoding='utf-8').write(open(mtl, encoding='utf-8').read().replace(tex, jpg))

zip_path = os.path.join(os.path.dirname(os.path.abspath(out_dir)), f'{name}_para_mixamo.zip')
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir(out_dir):
        if f.endswith(('.obj', '.mtl', '.png', '.jpg')):
            z.write(os.path.join(out_dir, f), f)
            print('  zip:', f, f'{os.path.getsize(os.path.join(out_dir, f)) / 1e6:.1f} MB')
print('LISTO ->', zip_path, f'{os.path.getsize(zip_path) / 1e6:.1f} MB')
