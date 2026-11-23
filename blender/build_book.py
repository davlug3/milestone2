"""
Build the Blender book scene from the analytic page model.

Run:
    blender -b -P blender/build_book.py -- --out blender/book.blend
    blender -b -P blender/build_book.py -- --out blender/book.blend --preview

The script is self-contained: no external assets, no simulation bake. It builds
the covers, page block, curved gutter plinth, 15 sheets and the studio, then
imports the analytic page shapes as shape keys and keyframes the cover/gutter.
"""

from __future__ import annotations

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# Make `import page_model` work when Blender runs this file.
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import page_model as pm  # noqa: E402


# --- Colour helpers -------------------------------------------------------

def _srgb_channel(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(hex_value: int):
    r = ((hex_value >> 16) & 0xFF) / 255.0
    g = ((hex_value >> 8) & 0xFF) / 255.0
    b = (hex_value & 0xFF) / 255.0
    return (_srgb_channel(r), _srgb_channel(g), _srgb_channel(b), 1.0)


def make_material(
    name: str,
    hex_value: int,
    roughness: float,
    bump: float = 0.0,
    noise_scale: float = 180.0,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = srgb(hex_value)
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(hex_value)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    if bump > 0.0:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = noise_scale
        tex.inputs["Detail"].default_value = 3.0
        tex.inputs["Roughness"].default_value = 0.55
        bmp = nt.nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = bump
        bmp.inputs["Distance"].default_value = 0.0002
        nt.links.new(tex.outputs["Fac"], bmp.inputs["Height"])
        nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# --- Object helpers -------------------------------------------------------

def new_collection(name: str):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def mesh_object(name: str, verts, faces, coll, material=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True
    return obj


def add_box(name, size, location, coll, material, bevel=0.0, segments=2):
    sx, sy, sz = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    coll.objects.link(obj)
    mesh.materials.append(material)
    if bevel > 0.0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(30)
    return obj


def add_bevel(obj, width, segments, vgroup=None):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    if vgroup is not None:
        mod.limit_method = "VGROUP"
        mod.vertex_group = vgroup
    else:
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(30)
    return mod


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# --- Scene parts ----------------------------------------------------------

def build_materials():
    return {
        "cover": make_material("CoverCloth", 0x1C2733, 0.82, bump=0.03, noise_scale=320),
        "cover_inner": make_material("Endpaper", 0xD9CBB2, 0.95, bump=0.02, noise_scale=260),
        "paper": make_material("Paper", 0xF4EFE4, 0.92, bump=0.07, noise_scale=180),
        "paper_edge": make_material("PaperEdge", 0xE6DCC8, 0.95, bump=0.04, noise_scale=220),
        "ground": make_material("StudioFloor", 0x08090B, 0.98),
    }


def build_covers(coll, mats):
    # Back cover: board + inner lining.
    add_box("cover-back", (pm.W, pm.CT, pm.H), (pm.W / 2, pm.CT / 2, 0), coll, mats["cover"], bevel=0.0006)
    add_box(
        "cover-back-lining",
        (pm.W * 0.97, pm.CT * 0.2, pm.H * 0.97),
        (pm.W / 2, pm.CT, 0),
        coll,
        mats["cover_inner"],
        bevel=0.0002,
    )

    # Front cover: board + lining, parented to a hinge empty at the spine.
    empty = bpy.data.objects.new("cover-hinge", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.02
    empty.location = (0.0, pm.CLOSED_CENTER_Y, 0.0)
    coll.objects.link(empty)

    board = add_box("cover-front", (pm.W, pm.CT, pm.H), (0, 0, 0), coll, mats["cover"], bevel=0.0006)
    lining = add_box(
        "cover-front-lining",
        (pm.W * 0.97, pm.CT * 0.2, pm.H * 0.97),
        (0, 0, 0),
        coll,
        mats["cover_inner"],
        bevel=0.0002,
    )
    for child, local in ((board, (pm.W / 2, 0.0, 0.0)), (lining, (pm.W / 2, -pm.CT / 2, 0.0))):
        child.parent = empty
        child.matrix_parent_inverse = Matrix.Identity(4)
        child.location = local
        child.rotation_euler = (0.0, 0.0, 0.0)
    return empty


def build_block(coll, mats):
    width = pm.W - pm.BLOCK_INNER_X
    obj = add_box(
        "page-block",
        (width, pm.PBT, pm.H * 0.97),
        (pm.BLOCK_INNER_X + width / 2, pm.CT + pm.PBT / 2, 0),
        coll,
        mats["paper_edge"],
    )
    # Vertex group for the inner-top edge only.
    vg = obj.vertex_groups.new(name="inner-top")
    idx = []
    for v in obj.data.vertices:
        if v.co.x < -width / 2 + 1e-6 and v.co.y > pm.PBT / 2 - 1e-6:
            idx.append(v.index)
    vg.add(idx, 1.0, "REPLACE")
    add_bevel(obj, pm.BLOCK_ROUND_R, 4, vgroup="inner-top")
    add_bevel(obj, 0.0003, 2)
    return obj


def build_plinth(coll, mats):
    nx = 24
    z0, z1 = -pm.H / 2, pm.H / 2
    xs = [-pm.GUTTER_HALF + (2 * pm.GUTTER_HALF * i) / nx for i in range(nx + 1)]

    verts = []
    top_idx = []
    bot_idx = []
    # Top row (j=0 at z0, j=1 at z1).
    for i, x in enumerate(xs):
        y = pm.gutter_surface_y(x, 1.0)
        top_idx.append([len(verts), len(verts) + 1])
        verts.append((x, y, z0))
        verts.append((x, y, z1))
    for i, x in enumerate(xs):
        bot_idx.append([len(verts), len(verts) + 1])
        verts.append((x, 0.0, z0))
        verts.append((x, 0.0, z1))

    faces = []
    for i in range(nx):
        t0, t1 = top_idx[i], top_idx[i + 1]
        b0, b1 = bot_idx[i], bot_idx[i + 1]
        # top (+Y)
        faces.append((t0[0], t0[1], t1[1], t1[0]))
        # bottom (-Y)
        faces.append((b0[0], b1[0], b1[1], b0[1]))
        # z0 side
        faces.append((t0[0], t1[0], b1[0], b0[0]))
        # z1 side
        faces.append((t0[1], b0[1], b1[1], t1[1]))
    # x end caps
    faces.append((top_idx[0][0], bot_idx[0][0], bot_idx[0][1], top_idx[0][1]))
    faces.append((top_idx[nx][0], top_idx[nx][1], bot_idx[nx][1], bot_idx[nx][0]))

    obj = mesh_object("gutter-plinth", verts, faces, coll, mats["cover_inner"])
    # Make normals consistent/outward.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()

    # Shape key: flat (u=0) vs dipped basis (u=1).
    obj.shape_key_add(name="Basis", from_mix=False)
    flat = obj.shape_key_add(name="Flat", from_mix=False)
    for i, x in enumerate(xs):
        for j in range(2):
            flat.data[top_idx[i][j]].co = (x, pm.LINING_TOP, z0 if j == 0 else z1)
    return obj


def build_static_sheets(coll, mats):
    width = pm.W - pm.STATIC_INNER_X
    for i in range(pm.NUM_STATIC):
        sheet_index = pm.NUM_TURNS + i
        y = pm.REST_BASE + (pm.NUM_SHEETS - 1 - sheet_index) * pm.SHEET_VSTEP
        add_box(
            f"static-sheet-{i}",
            (width, pm.SHEET_VSTEP * 0.9, pm.H * 0.97),
            (pm.STATIC_INNER_X + width / 2, y, 0),
            coll,
            mats["paper"] if i % 2 == 0 else mats["paper_edge"],
        )


def build_pages(coll, mats, key_steps=25):
    pages = []
    key_ps = pm.key_progress_values(key_steps)
    for k in range(pm.NUM_TURNS):
        spec = pm.page_spec(k)
        rest = pm.page_points(spec, 0.0)
        verts = [(x, y, z) for x, y, z in rest]
        faces = []
        for r in range(pm.ROWS - 1):
            for c in range(pm.COLS - 1):
                a = r * pm.COLS + c
                b = (r + 1) * pm.COLS + c
                faces.append((a, b, b + 1, a + 1))
        obj = mesh_object(f"page-{k}", verts, faces, coll, mats["paper"], smooth=True)
        obj.data.materials.append(mats["paper_edge"])

        obj.shape_key_add(name="Basis", from_mix=False)
        for p in key_ps:
            kb = obj.shape_key_add(name=f"p{p:.2f}", from_mix=False)
            pts = pm.page_points(spec, p)
            for i, (x, y, z) in enumerate(pts):
                kb.data[i].co = (x, y, z)

        solid = obj.modifiers.new("PaperThickness", "SOLIDIFY")
        solid.thickness = 0.00025
        solid.offset = 0.0
        solid.use_even_offset = True
        solid.material_offset = 0
        solid.material_offset_rim = 1

        pages.append((obj, spec, key_ps))
    return pages


# --- Animation ------------------------------------------------------------

def animate_cover(empty, fps):
    f0 = pm.frame_for_time(pm.COVER_START, fps)
    f1 = pm.frame_for_time(pm.COVER_END, fps)
    for f in range(f0, f1 + 1):
        t = (f - 1) / fps
        u = pm.clamp01((t - pm.COVER_START) / (pm.COVER_END - pm.COVER_START))
        angle, hinge_y = pm.cover_pose(u)
        empty.rotation_euler = (0.0, 0.0, angle)
        empty.location = (0.0, hinge_y, 0.0)
        empty.keyframe_insert("rotation_euler", frame=f)
        empty.keyframe_insert("location", frame=f)


def animate_plinth(plinth, fps):
    kb = plinth.data.shape_keys.key_blocks["Flat"]
    f0 = pm.frame_for_time(pm.COVER_START, fps)
    f1 = pm.frame_for_time(pm.COVER_END, fps)
    for f, value in ((f0, 1.0), (f1, 0.0)):
        kb.value = value
        kb.keyframe_insert("value", frame=f)


def animate_pages(pages, fps):
    for obj, spec, key_ps in pages:
        keys = obj.data.shape_keys.key_blocks
        start = pm.FIRST_TURN + spec.k * pm.TURN_GAP
        f0 = pm.frame_for_time(start, fps)
        f1 = pm.frame_for_time(start + pm.TURN_DUR, fps)

        # Hold the rest shape before the turn.
        for kb in keys:
            if kb.name != "Basis":
                kb.value = 0.0
                kb.keyframe_insert("value", frame=max(1, f0 - 1))
        keys["Basis"].value = 1.0

        frames = []
        for p in key_ps:
            frames.append((p, pm.frame_for_time(start + p * pm.TURN_DUR, fps)))

        for i, (p, f) in enumerate(frames):
            kb = keys[f"p{p:.2f}"]
            prev_f = frames[i - 1][1] if i > 0 else f0
            next_f = frames[i + 1][1] if i + 1 < len(frames) else f1
            kb.value = 0.0
            kb.keyframe_insert("value", frame=prev_f)
            kb.value = 1.0
            kb.keyframe_insert("value", frame=f)
            kb.value = 0.0
            kb.keyframe_insert("value", frame=next_f)


# --- Studio ---------------------------------------------------------------

def build_studio(coll, mats):
    # Ground.
    add_box("ground", (6.0, 0.002, 6.0), (0.0, -0.001, 0.0), coll, mats["ground"])

    # Camera.
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle = math.radians(42.0)
    cam_data.clip_start = 0.01
    cam_data.clip_end = 100.0
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0.0, 0.74, 0.63)
    look_at(cam, (0.0, 0.0, 0.0))
    coll.objects.link(cam)
    bpy.context.scene.camera = cam

    # Key: sun from upper-left/front.
    key_data = bpy.data.lights.new("Key", "SUN")
    key_data.energy = 2.5
    key_data.angle = math.radians(8.0)
    key_data.color = (1.0, 0.93, 0.85)
    key = bpy.data.objects.new("Key", key_data)
    key.location = (-0.6, 0.9, 0.5)
    look_at(key, (0.0, 0.03, 0.0))
    coll.objects.link(key)

    # Fill / rim / gutter fill.
    for name, loc, energy, color, size in (
        ("Fill", (0.7, 0.4, -0.3), 60.0, (0.85, 0.9, 1.0), 1.0),
        ("Rim", (0.1, 0.3, -0.8), 100.0, (1.0, 1.0, 1.0), 0.6),
        ("GutterFill", (0.1, 1.0, 0.3), 40.0, (1.0, 0.95, 0.88), 0.5),
    ):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.shape = "DISK"
        ld.size = size
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        look_at(lo, (0.0, 0.03, 0.0))
        coll.objects.link(lo)

    # World.
    world = bpy.data.worlds.new("StudioWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.004, 0.005, 0.006, 1.0)
    bg.inputs[1].default_value = 0.2
    bpy.context.scene.world = world


# --- Render ---------------------------------------------------------------

def setup_render(scene, width, height, samples):
    # Cycles is much cleaner for the large flat page surfaces (EEVEE Next
    # produces a visible per-quad shading grid on them).
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception:
        pass
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 4
    except Exception:
        pass
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps = pm.FPS
    scene.frame_start = 1
    scene.frame_end = pm.frame_for_time(pm.DURATION, pm.FPS)
    try:
        scene.eevee.taa_render_samples = samples
    except Exception:
        pass
    try:
        scene.view_settings.view_transform = "AgX"
    except Exception:
        pass
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = 0.2


def render_previews(scene, out_dir, times, width=960, height=540, samples=16):
    os.makedirs(out_dir, exist_ok=True)
    old = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    try:
        scene.cycles.samples = samples
    except Exception:
        pass
    for t in times:
        scene.frame_set(pm.frame_for_time(t, pm.FPS))
        scene.render.filepath = os.path.join(out_dir, f"t{t:04.1f}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", scene.render.filepath)
    scene.render.resolution_x, scene.render.resolution_y = old


# --- Main -----------------------------------------------------------------

def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "book.blend"))
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--preview-dir", default=os.path.join(HERE, "renders"))
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--key-steps", type=int, default=25)
    return ap.parse_args(argv)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    except Exception:
        pass

    scene = bpy.context.scene
    scene.name = "Book"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    mats = build_materials()
    book = new_collection("Book")
    pages_coll = new_collection("Pages")
    studio = new_collection("Studio")

    build_covers(book, mats)
    hinge = bpy.data.objects["cover-hinge"]
    build_block(book, mats)
    plinth = build_plinth(book, mats)
    build_static_sheets(book, mats)
    pages = build_pages(pages_coll, mats, key_steps=args.key_steps)
    build_studio(studio, mats)

    animate_cover(hinge, pm.FPS)
    animate_plinth(plinth, pm.FPS)
    animate_pages(pages, pm.FPS)

    setup_render(scene, args.width, args.height, args.samples)
    scene.frame_set(1)

    # Report.
    print("PAGES", len(pages), "KEYS", [len(p[2]) for p in pages])
    print("FRAMES", scene.frame_start, scene.frame_end, "FPS", scene.render.fps)

    if args.preview:
        render_previews(
            scene,
            args.preview_dir,
            [0.0, 1.6, 2.4, 2.8, 4.6, 5.0, 5.6, 5.9, 6.4, 30.0],
        )

    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.out), compress=True)
    print("SAVED", os.path.abspath(args.out))


if __name__ == "__main__":
    main()