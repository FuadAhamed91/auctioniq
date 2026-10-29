"""Build the AuctionIQ auction room and export it for the web app.

Run headless from the repo root:

    blender -b --factory-startup -P blender/build_room.py

Builds every object from an empty scene, writes web/public/assets/room.glb (Draco,
Y-up, modifiers applied, camera but no lights, neutral team materials) and then renders
blender/preview.png from Cam_Main with stand-in lights and team colours that never reach
the GLB. Blender works Z-up with +Y pointing from the camera to the stage, so a
Blender point (x, y, z) lands at (x, z, -y) in three.js.
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
GLB_PATH = ROOT / "web" / "public" / "assets" / "room.glb"
PREVIEW_PATH = ROOT / "blender" / "preview.png"

# Shared materials: sRGB colour, roughness, metallic, emission strength. A bright studio set
# with two dark accents: the LED wall and the hero cricketer on the plinth.
MATERIALS = {
    "M_Floor": ("#ECE9E2", 0.3, 0.0, 0.0),  # satin, slightly reflective
    "M_Wall": ("#F3F1EC", 0.85, 0.0, 0.0),
    "M_Surface": ("#FFFFFF", 0.5, 0.0, 0.0),  # stage, desk tops, the rail around each lamp
    "M_Furniture": ("#E4E1DA", 0.55, 0.0, 0.0),  # podium body, chairs
    "M_Trim": ("#D6D9DF", 0.4, 0.0, 0.0),
    "M_Plinth": ("#F7F6F2", 0.45, 0.0, 0.0),
    "M_Flood": ("#FFF6E6", 0.5, 0.0, 0.8),  # light strips: a low glow so they read as fixtures
    "M_ScreenFrame": ("#2C3442", 0.4, 0.0, 0.0),
    "M_Screen": ("#0F1218", 0.2, 0.0, 0.0),  # dark LED wall; the app maps content onto it
    "M_Silhouette": ("#B7BDC6", 0.85, 0.0, 0.0),  # seated figures and auctioneer
    "M_Hero": ("#0F1218", 0.75, 0.0, 0.0),  # plinth cricketers
    "M_Brass": ("#E0A63C", 0.22, 1.0, 0.0),
    "M_Teal": ("#3FC1B0", 0.4, 0.0, 1.5),
    "M_Red": ("#E25A4C", 0.45, 0.0, 0.3),
    "M_Handle": ("#2C3442", 0.4, 0.0, 0.0),  # paddle handles
}
# One material per team for each of these. The app owns team colours and tints desks, plates
# and paddle blades, so the export carries neutral defaults.
LAMP_FINISH = ("#3FC1B0", 0.4, 0.0, 2.0)  # M_Lamp_<CODE>
DESK_FINISH = ("#E4E1DA", 0.45, 0.0, 0.0)  # M_Desk_<CODE>: front panel and sides, satin
PLATE_FINISH = ("#CDD2D9", 0.4, 0.0, 0.0)  # M_Plate_<CODE>
PADDLE_FINISH = ("#E0A63C", 0.35, 0.0, 0.0)  # M_Paddle_<CODE>: glossy, non-metallic, takes a tint
JERSEY_FINISH = ("#B7BDC6", 0.8, 0.0, 0.0)  # M_Jersey_<CODE> / M_Sleeve_<CODE>: the seated figures' kit, matte

# Team colours (primary, secondary), used only to tint the preview render.
PREVIEW_TEAM_COLOURS = {
    "CSK": ("#F9CD05", "#F15C19"),
    "DC": ("#2561AE", "#D71921"),
    "GT": ("#1B2133", "#DBBE6E"),
    "KKR": ("#3A225D", "#F2C028"),
    "LSG": ("#0057E2", "#F28B00"),
    "MI": ("#005FA2", "#F79433"),
    "PBKS": ("#ED1D24", "#A7A9AC"),
    "RCB": ("#EC1C24", "#252829"),
    "RR": ("#EA1A85", "#254AA5"),
    "SRH": ("#F26522", "#1D1D1B"),
}

# Left to right as seen from Cam_Main.
TEAMS = ("CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH")

# Layout in metres. The podium stands at the origin and the table arc is centred on it.
ROOM_HALF_W = 15.0
ROOM_SOUTH_Y = -24.0
WALL_N_Y = 5.6
WALL_H = 10.0
WALL_T = 0.3

STAGE_H = 0.6
STAGE_HALF_W = 8.5
STAGE_FRONT_Y = -1.5  # apex of the bowed front edge
STAGE_CORNER_Y = -0.3

SCREEN_W, SCREEN_H = 8.0, 4.5
SCREEN_Y = WALL_N_Y - 0.26
SCREEN_BOTTOM = STAGE_H + 2.2

PODIUM_H = 1.12
AUCTIONEER_Y = 0.55
GAVEL_PIVOT = Vector((-0.26, 0.07, STAGE_H + PODIUM_H + 0.1))
GAVEL_REST = math.radians(35)  # handle tilt at rest; +35 deg about X lands the head on the block
GAVEL_LEN = 0.3
GAVEL_HEAD_R = 0.046

PLINTH = Vector((4.0, 2.0))
PLINTH_H = 0.13
SILHOUETTE_SCALE = 1.1

ARC_RADIUS = 10.0
ARC_SPAN = math.radians(140)
# Tables turn toward a point behind the stage rather than toward the podium, so the
# camera still sees the backs of the outermost tables.
TABLE_FOCUS = Vector((0.0, 9.0))
TABLE_W = 1.8
DESK_TOP = 0.76
DESK_BACK = -0.36
DESK_FRONT = 0.3
FASCIA_TOP = 1.0  # the front panel rises above the desk; the lamp sits on its top-back edge
PLATE_Z, PLATE_H = 0.875, 0.15  # nameplate band on the back of the front panel, below the lamp
SEAT = Vector((0.42, -0.62))
PADDLE_SPOT = Vector((0.66, -0.2))  # mirrored to the table end nearer the room's centre line
ANCHOR_RISE = 1.2

CAM_POS = Vector((0.0, -17.5, 9.4))  # high enough that the end desks (CSK, SRH) clear their neighbours
CAM_TARGET = Vector((0.0, -2.2, 1.7))
CAM_FOV_Y = math.radians(50)
RESOLUTION = (1920, 1080)

SMOOTH_ANGLE = math.radians(48)


def v(x, y, z):
    return Vector((x, y, z))


def linspace(start, stop, count):
    return [start + (stop - start) * k / (count - 1) for k in range(count)]


def basis(x_axis, z_hint):
    """Orthonormal rotation whose X follows x_axis and whose Z is as close to z_hint as possible."""
    x = x_axis.normalized()
    z = (z_hint - x * x.dot(z_hint)).normalized()
    return Matrix((x, z.cross(x), z)).transposed()


def yaw_towards(src, dst):
    """Rotation about Z that turns local +Y from src toward dst (2D points)."""
    d = dst - src
    return math.atan2(-d.x, d.y)


def arc_point(radius, angle):
    """Point on a circle around the podium; angle 0 faces the camera, negative is screen-left."""
    return Vector((radius * math.sin(angle), -radius * math.cos(angle)))


# --- materials ---------------------------------------------------------------------------


def srgb_to_linear(hex_color):
    channels = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels)


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def make_material(name, color, roughness, metallic, emission):
    mat = bpy.data.materials.new(name)
    bsdf = principled(mat)
    rgba = (*srgb_to_linear(color), 1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def make_materials():
    return {name: make_material(name, *finish) for name, finish in MATERIALS.items()}


# --- geometry ----------------------------------------------------------------------------


class MeshBuilder:
    """Collects closed primitives into one bmesh, with one material slot per material."""

    def __init__(self):
        self.bm = bmesh.new()
        self.materials = []

    def loft(self, rings, mat):
        """Skin consecutive closed rings of points; one-point rings are poles, ends are capped."""
        verts = [[self.bm.verts.new(p) for p in ring] for ring in rings]
        faces = []
        for lower, upper in zip(verts, verts[1:]):
            for k in range(max(len(lower), len(upper))):
                corners = (
                    lower[k % len(lower)],
                    lower[(k + 1) % len(lower)],
                    upper[(k + 1) % len(upper)],
                    upper[k % len(upper)],
                )
                faces.append(self.bm.faces.new(list(dict.fromkeys(corners))))
        faces += [self.bm.faces.new(ring) for ring in (verts[0], verts[-1]) if len(ring) > 2]
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        if mat not in self.materials:
            self.materials.append(mat)
        for face in faces:
            face.material_index = self.materials.index(mat)
            face.smooth = True

    def box(self, center, size, mat, rotation=None):
        hx, hy, hz = (s / 2 for s in size)
        frame = Matrix.Translation(center) @ (rotation or Matrix.Identity(3)).to_4x4()
        corners = ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))
        self.loft([[frame @ v(x, y, z) for x, y in corners] for z in (-hz, hz)], mat)

    def frustum(self, center, bottom, top, height, mat):
        """Box whose footprint changes linearly from `bottom` to `top` (x, y sizes)."""
        corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
        rings = [
            [center + v(sx * px / 2, sy * py / 2, z) for px, py in corners]
            for (sx, sy), z in ((bottom, 0.0), (top, height))
        ]
        self.loft(rings, mat)

    def lathe(self, profile, mat, matrix=Matrix.Identity(4), segments=16):
        """Revolve (radius, z) pairs around local Z."""
        angles = [2 * math.pi * k / segments for k in range(segments)]
        rings = [
            [matrix @ v(0, 0, z)] if r < 1e-6 else [matrix @ v(r * math.cos(a), r * math.sin(a), z) for a in angles]
            for r, z in profile
        ]
        self.loft(rings, mat)

    def capsule(self, a, b, ra, rb, mat, segments=8, rings=2):
        axis = b - a
        steps = [math.pi / 2 * k / rings for k in range(rings + 1)]
        profile = [(ra * math.sin(t), -ra * math.cos(t)) for t in steps]
        profile += [(rb * math.cos(t), axis.length + rb * math.sin(t)) for t in steps]
        frame = Matrix.Translation(a) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
        self.lathe(profile, mat, frame, segments)

    def ellipsoid(self, center, radii, mat, rotation=None, segments=12, rings=6):
        profile = [(math.sin(math.pi * k / rings), -math.cos(math.pi * k / rings)) for k in range(rings + 1)]
        frame = Matrix.Translation(center) @ (rotation or Matrix.Identity(3)).to_4x4()
        self.lathe(profile, mat, frame @ Matrix.Diagonal((*radii, 1)), segments)

    def strip(self, points, width, z0, z1, mat):
        """Thin band following a 2D polyline (inlays and edge lights)."""
        rings = []
        for k, p in enumerate(points):
            tangent = (points[min(k + 1, len(points) - 1)] - points[max(k - 1, 0)]).normalized()
            offset = Vector((-tangent.y, tangent.x)) * (width / 2)
            left, right = p + offset, p - offset
            rings.append([v(*left, z0), v(*right, z0), v(*right, z1), v(*left, z1)])
        self.loft(rings, mat)

    def transform(self, matrix):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=self.bm.verts)

    def to_mesh(self, name):
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        mesh.set_sharp_from_angle(angle=SMOOTH_ANGLE)
        return mesh


def add_object(name, data=None, parent=None, location=(0, 0, 0), yaw=0.0):
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler.z = yaw
    return obj


def mesh_object(name, builder, parent=None, location=(0, 0, 0), yaw=0.0, bevel=0.0):
    obj = add_object(name, builder.to_mesh(name), parent, location, yaw)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        mod.harden_normals = True
    return obj


def add_empty(name, location, parent=None):
    obj = add_object(name, None, parent, location)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.25
    return obj


# --- figures -----------------------------------------------------------------------------


def add_body(b, j, mat, segments=8, helmet=False, pads=False, hand_radii=(0.045, 0.04, 0.055),
             shirt=None, sleeve=None):
    """Faceless mannequin from a joint dict (keys like shoulder_l, hand_r, toe_l). shirt and sleeve,
    if given, dress the torso and upper arms (a plain two-tone kit, no logos)."""
    shirt = shirt or mat
    sleeve = sleeve or shirt
    up = (j["neck"] - j["pelvis"]).normalized()
    torso = basis(j["shoulder_r"] - j["shoulder_l"], up)
    gaze = j.get("gaze", torso.col[1]).normalized()
    head = basis(gaze.cross(v(0, 0, 1)), v(0, 0, 1))
    b.ellipsoid(j["chest"], (0.185, 0.115, 0.2), shirt, torso, segments + 4)
    b.ellipsoid(j["pelvis"], (0.16, 0.11, 0.12), mat, torso, segments + 4)
    b.capsule(j["pelvis"], j["chest"], 0.13, 0.14, shirt, segments)
    b.capsule(j["chest"], j["head"], 0.05, 0.05, mat, segments)
    head_radii = (0.105, 0.115, 0.122) if helmet else (0.092, 0.104, 0.118)
    b.ellipsoid(j["head"], head_radii, mat, head, segments + 4)
    if helmet:
        b.ellipsoid(j["head"] + gaze * 0.1 + head.col[2] * 0.05, (0.085, 0.08, 0.016), mat, head)
        b.ellipsoid(j["head"] + gaze * 0.09 - head.col[2] * 0.05, (0.07, 0.04, 0.055), mat, head)
    for s in "lr":
        knee, ankle = j["knee_" + s], j["ankle_" + s]
        b.capsule(j["shoulder_" + s], j["elbow_" + s], 0.058, 0.047, sleeve, segments)
        b.capsule(j["elbow_" + s], j["hand_" + s], 0.047, 0.038, mat, segments)
        forearm = j["hand_" + s] - j["elbow_" + s]
        b.ellipsoid(j["hand_" + s], hand_radii, mat, basis(torso.col[0], forearm), segments)
        b.capsule(j["hip_" + s], knee, 0.085, 0.064, mat, segments)
        if pads:
            b.capsule(knee + (knee - ankle).normalized() * 0.08, ankle, 0.082, 0.07, mat, segments)
        else:
            b.capsule(knee, ankle, 0.062, 0.046, mat, segments)
        b.capsule(ankle, j["toe_" + s], 0.045, 0.038, mat, segments)


def joints(**points):
    return {name: v(*p) for name, p in points.items()}


def mirrored(**points):
    """Left/right joint pairs from right-side coordinates (+X is the figure's right)."""
    return {f"{name}_{side}": v(x * s, y, z) for name, (x, y, z) in points.items() for side, s in (("l", -1), ("r", 1))}


def seated_joints(hold_side=0):
    """Seated, facing +Y, origin on the floor below the seat; hold_side (-1/+1) grips the paddle."""
    j = joints(pelvis=(0, -0.02, 0.6), chest=(0, 0.03, 0.9), neck=(0, 0.06, 1.08), head=(0, 0.08, 1.23))
    j |= mirrored(
        shoulder=(0.2, 0.04, 1.05), elbow=(0.26, 0.24, 0.85), hand=(0.19, 0.45, DESK_TOP + 0.05),
        hip=(0.1, 0, 0.56), knee=(0.12, 0.44, 0.55), ankle=(0.13, 0.48, 0.1), toe=(0.13, 0.6, 0.04),
    )
    if hold_side:
        side = "r" if hold_side > 0 else "l"
        reach = PADDLE_SPOT - SEAT
        j["elbow_" + side] = v(0.33 * hold_side, 0.2, 0.86)
        j["hand_" + side] = v(reach.x * hold_side, reach.y, DESK_TOP + 0.1)
    return j


def auctioneer_joints():
    """Standing, facing +Y (the object turns to face the room); right hand on the gavel pivot."""
    j = joints(
        pelvis=(0, 0, 0.96), chest=(0, 0.03, 1.33), neck=(0, 0.05, 1.52), head=(0, 0.06, 1.67),
        shoulder_l=(-0.2, 0.03, 1.46), elbow_l=(-0.28, 0.22, 1.2), hand_l=(-0.22, 0.42, 1.16),
        shoulder_r=(0.2, 0.03, 1.46), elbow_r=(0.3, 0.24, 1.22),
        hand_r=(-GAVEL_PIVOT.x, AUCTIONEER_Y - GAVEL_PIVOT.y, GAVEL_PIVOT.z - STAGE_H),
    )
    return j | mirrored(hip=(0.1, 0, 0.92), knee=(0.11, 0.02, 0.5), ankle=(0.12, 0, 0.09), toe=(0.12, 0.13, 0.04))


def batter_joints():
    """Right-hander in his stance with a high backlift; chest faces +Y, bowler toward -X."""
    return joints(
        pelvis=(0, 0, 0.9), chest=(-0.02, 0.08, 1.24), neck=(-0.04, 0.1, 1.43), head=(-0.07, 0.11, 1.58),
        gaze=(-1, 0.25, 0),
        shoulder_l=(-0.21, 0.08, 1.38), elbow_l=(0.02, 0.27, 1.22), hand_l=(0.27, 0.2, 1.14),
        shoulder_r=(0.18, 0.06, 1.38), elbow_r=(0.42, 0.04, 1.13), hand_r=(0.31, 0.2, 1.22),
        hip_l=(-0.1, 0, 0.87), knee_l=(-0.27, 0.14, 0.48), ankle_l=(-0.32, 0, 0.09), toe_l=(-0.32, 0.15, 0.04),
        hip_r=(0.1, 0, 0.87), knee_r=(0.23, 0.12, 0.48), ankle_r=(0.28, -0.02, 0.09), toe_r=(0.28, 0.13, 0.04),
    )


def bowler_joints():
    """Right-arm bowler at release, mid-stride: bowling arm high, back foot off the ground; runs toward +Y."""
    return joints(
        pelvis=(0, 0.05, 0.96), chest=(0, 0.2, 1.29), neck=(0, 0.28, 1.46), head=(0, 0.34, 1.6),
        shoulder_l=(-0.17, 0.22, 1.41), elbow_l=(-0.2, 0.46, 1.27), hand_l=(-0.18, 0.66, 1.12),
        shoulder_r=(0.17, 0.2, 1.42), elbow_r=(0.18, 0.26, 1.72), hand_r=(0.17, 0.3, 2.0),
        hip_l=(-0.09, 0.08, 0.94), knee_l=(-0.09, 0.34, 0.52), ankle_l=(-0.09, 0.54, 0.09), toe_l=(-0.09, 0.68, 0.03),
        hip_r=(0.09, 0.02, 0.94), knee_r=(0.09, -0.2, 0.55), ankle_r=(0.09, -0.58, 0.36), toe_r=(0.09, -0.68, 0.3),
    )


def keeper_joints():
    """Wicketkeeper crouched, gloves together in front of the knees; faces +Y."""
    j = joints(pelvis=(0, -0.16, 0.58), chest=(0, 0.04, 0.86), neck=(0, 0.14, 1.0), head=(0, 0.22, 1.11))
    return j | mirrored(
        shoulder=(0.18, 0.08, 0.96), elbow=(0.18, 0.34, 0.72), hand=(0.075, 0.6, 0.48),
        hip=(0.12, -0.14, 0.55), knee=(0.25, 0.26, 0.42), ankle=(0.2, -0.02, 0.12), toe=(0.2, 0.13, 0.03),
    )


# --- room --------------------------------------------------------------------------------


def build_room(mats):
    depth = WALL_N_Y - ROOM_SOUTH_Y
    mid_y = (ROOM_SOUTH_Y + WALL_N_Y) / 2
    floor = MeshBuilder()
    floor.box(v(0, mid_y, -0.05), (2 * ROOM_HALF_W, depth, 0.1), mats["M_Floor"])
    mesh_object("Floor", floor)

    width = 2 * ROOM_HALF_W + 2 * WALL_T
    walls = {
        "Wall_North": (v(0, WALL_N_Y + WALL_T / 2, WALL_H / 2), (width, WALL_T, WALL_H)),
        "Wall_South": (v(0, ROOM_SOUTH_Y - WALL_T / 2, WALL_H / 2), (width, WALL_T, WALL_H)),
        "Wall_West": (v(-ROOM_HALF_W - WALL_T / 2, mid_y, WALL_H / 2), (WALL_T, depth + 2 * WALL_T, WALL_H)),
        "Wall_East": (v(ROOM_HALF_W + WALL_T / 2, mid_y, WALL_H / 2), (WALL_T, depth + 2 * WALL_T, WALL_H)),
    }
    for name, (center, size) in walls.items():
        wall = MeshBuilder()
        wall.box(center, size, mats["M_Wall"])
        mesh_object(name, wall)

    blades = MeshBuilder()
    for x in (-6.8, -6.2, 6.2, 6.8):
        blades.box(v(x, WALL_N_Y - 0.02, 4.4), (0.06, 0.04, 7.6), mats["M_Flood"])
    mesh_object("LightBlades", blades)

    inlay = MeshBuilder()
    sweep = ARC_SPAN / 2 + math.radians(8)
    for radius in (ARC_RADIUS - 1.9, ARC_RADIUS + 2.0):
        points = [arc_point(radius, a) for a in linspace(-sweep, sweep, 96)]
        inlay.strip(points, 0.05, 0.0, 0.006, mats["M_Trim"])
    mesh_object("Inlay", inlay)


def stage_front():
    """Front edge of the stage: a shallow circular arc bowing toward the tables."""
    sagitta = STAGE_CORNER_Y - STAGE_FRONT_Y
    radius = (STAGE_HALF_W**2 + sagitta**2) / (2 * sagitta)
    half = math.asin(STAGE_HALF_W / radius)
    center_y = STAGE_FRONT_Y + radius
    return [Vector((radius * math.sin(a), center_y - radius * math.cos(a))) for a in linspace(-half, half, 41)]


def build_stage(mats):
    front = stage_front()
    back_left, back_right = Vector((-STAGE_HALF_W, WALL_N_Y)), Vector((STAGE_HALF_W, WALL_N_Y))
    stage = MeshBuilder()
    stage.loft([[v(*p, z) for p in front + [back_right, back_left]] for z in (0.0, STAGE_H)], mats["M_Surface"])
    stage.strip([back_left, *front, back_right], 0.02, STAGE_H - 0.055, STAGE_H - 0.032, mats["M_Trim"])
    mesh_object("Stage", stage, bevel=0.03)

    edge = MeshBuilder()
    edge.strip(front, 0.03, 0.035, 0.06, mats["M_Flood"])
    mesh_object("EdgeLight", edge)


def build_screen(mats):
    center = v(0, SCREEN_Y, SCREEN_BOTTOM + SCREEN_H / 2)
    frame = MeshBuilder()
    border = 0.18
    outer_w, outer_h = SCREEN_W + 2 * border, SCREEN_H + 2 * border
    back_depth = WALL_N_Y - SCREEN_Y - 0.01
    frame.box(center + v(0, 0.01 + back_depth / 2, 0), (outer_w, back_depth, outer_h), mats["M_ScreenFrame"])
    for z in (-1, 1):
        frame.box(center + v(0, -0.01, z * (SCREEN_H + border) / 2), (outer_w, 0.06, border), mats["M_ScreenFrame"])
    for x in (-1, 1):
        frame.box(center + v(x * (SCREEN_W + border) / 2, -0.01, 0), (border, 0.06, SCREEN_H), mats["M_ScreenFrame"])
    mesh_object("Screen", frame, bevel=0.015)

    hx, hz = SCREEN_W / 2, SCREEN_H / 2
    panel = bpy.data.meshes.new("ScreenPanel")
    panel.from_pydata([(-hx, 0, -hz), (hx, 0, -hz), (hx, 0, hz), (-hx, 0, hz)], [], [(0, 1, 2, 3)])
    uv = panel.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = coord
    panel.materials.append(mats["M_Screen"])
    add_object("ScreenPanel", panel, location=center)
    add_empty("Anchor_Screen", center)


def build_podium(mats):
    body_h = PODIUM_H - 0.05
    bottom, top = (0.84, 0.5), (0.96, 0.58)
    podium = MeshBuilder()
    podium.frustum(v(0, 0, STAGE_H), bottom, top, body_h, mats["M_Furniture"])
    podium.box(v(0, 0, STAGE_H + PODIUM_H - 0.025), (1.06, 0.66, 0.05), mats["M_Surface"])
    podium.box(v(0, 0, STAGE_H + 0.03), (0.92, 0.58, 0.06), mats["M_Trim"])

    band_h = 0.8 * body_h
    lean = (top[1] - bottom[1]) / 2
    front_y = -(bottom[1] / 2 + lean * band_h / body_h)
    width = bottom[0] + (top[0] - bottom[0]) * band_h / body_h
    tilt = Matrix.Rotation(math.atan2(lean, body_h), 3, "X")
    podium.box(v(0, front_y - 0.008, STAGE_H + band_h), (width - 0.12, 0.03, 0.045), mats["M_Brass"], tilt)

    block_top = GAVEL_PIVOT.z - GAVEL_HEAD_R
    block_base = STAGE_H + PODIUM_H
    strike = Matrix.Translation((GAVEL_PIVOT.x, GAVEL_PIVOT.y - GAVEL_LEN, 0))
    block = [(0, block_base), (0.075, block_base), (0.075, block_top), (0, block_top)]
    podium.lathe(block, mats["M_Brass"], strike, 20)
    mesh_object("Podium", podium, bevel=0.012)
    add_empty("Anchor_Podium", v(0, 0, STAGE_H + PODIUM_H + 1.0))


def build_hammer(mats):
    handle = v(0, -math.cos(GAVEL_REST), math.sin(GAVEL_REST))
    gavel = MeshBuilder()
    gavel.capsule(-handle * 0.04, handle * GAVEL_LEN, 0.016, 0.016, mats["M_Brass"], 10)
    head = Matrix.Translation(handle * GAVEL_LEN) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    r = GAVEL_HEAD_R
    profile = [(0, -0.08), (r - 0.006, -0.08), (r, -0.07), (r, 0.07), (r - 0.006, 0.08), (0, 0.08)]
    gavel.lathe(profile, mats["M_Brass"], head, 16)
    mesh_object("Hammer", gavel, location=GAVEL_PIVOT)


def build_auctioneer(mats):
    body = MeshBuilder()
    add_body(body, auctioneer_joints(), mats["M_Silhouette"], segments=10)
    mesh_object("Auctioneer", body, location=v(0, AUCTIONEER_Y, STAGE_H), yaw=math.pi)


def build_silhouettes(mats):
    plinth = MeshBuilder()
    disc = [(0, 0), (0.8, 0), (0.82, 0.03), (0.82, PLINTH_H - 0.024), (0.8, PLINTH_H), (0, PLINTH_H)]
    plinth.lathe(disc, mats["M_Plinth"], segments=48)
    rim = [(0, 0.078), (0.832, 0.078), (0.832, 0.092), (0, 0.092)]  # thin teal line around the side
    plinth.lathe(rim, mats["M_Teal"], segments=48)
    mesh_object("Plinth", plinth, location=v(*PLINTH, STAGE_H))

    # Bowler and keeper are posed side-on to Cam_Main, heading screen-left; the batter faces it.
    view = (PLINTH - CAM_POS.xy).normalized()
    side_on = yaw_towards(Vector((0, 0)), Vector((-view.y, view.x)))
    facing = yaw_towards(Vector((0, 0)), -view)
    base = v(*PLINTH, STAGE_H + PLINTH_H)
    scale = Matrix.Scale(SILHOUETTE_SCALE, 4)

    batter = MeshBuilder()
    j = batter_joints()
    add_body(batter, j, mats["M_Hero"], 10, helmet=True, pads=True, hand_radii=(0.055, 0.05, 0.065))
    lift = v(0.45, -0.05, 0.89).normalized()  # bat raised up and back from the grip
    blade_width = Vector((lift.z, 0, -lift.x))
    batter.capsule(j["hand_l"] - lift * 0.07, j["hand_l"] + lift * 0.22, 0.021, 0.021, mats["M_Hero"])
    batter.box(j["hand_l"] + lift * 0.5, (0.115, 0.055, 0.58), mats["M_Hero"], basis(blade_width, lift))
    batter.transform(scale)
    mesh_object("Silhouette_Batter", batter, location=base, yaw=facing)

    bowler = MeshBuilder()
    j = bowler_joints()
    add_body(bowler, j, mats["M_Hero"], 10)
    bowler.ellipsoid(j["hand_r"] + v(0, 0.02, 0.07), (0.055, 0.055, 0.055), mats["M_Red"])
    bowler.transform(scale)
    mesh_object("Silhouette_Bowler", bowler, location=base, yaw=side_on)

    keeper = MeshBuilder()
    add_body(keeper, keeper_joints(), mats["M_Hero"], 10, helmet=True, pads=True, hand_radii=(0.085, 0.07, 0.12))
    keeper.transform(scale)
    mesh_object("Silhouette_Keeper", keeper, location=base, yaw=side_on)


# --- franchise tables --------------------------------------------------------------------


def add_chair(b, spot, mats):
    at = Matrix.Translation((*spot, 0))
    b.lathe([(0, 0.005), (0.24, 0.005), (0.24, 0.04), (0, 0.04)], mats["M_Trim"], at, 16)
    b.lathe([(0, 0.04), (0.03, 0.04), (0.03, 0.42), (0, 0.42)], mats["M_Trim"], at, 12)
    b.box(v(*spot, 0.445), (0.48, 0.46, 0.06), mats["M_Furniture"])
    b.box(v(spot.x, spot.y - 0.235, 0.63), (0.44, 0.05, 0.3), mats["M_Furniture"])


def table_builder(mats, desk_mat):
    """Desk with a team-coloured front panel and sides, a white top, and a white rail framing
    the lamp so its state colour reads against any team colour."""
    desk_y, desk_d = (DESK_BACK + DESK_FRONT) / 2, DESK_FRONT - DESK_BACK
    panel_h, leg_h = FASCIA_TOP - 0.055, DESK_TOP - 0.05
    b = MeshBuilder()
    b.box(v(0, desk_y, DESK_TOP - 0.025), (TABLE_W, desk_d, 0.05), mats["M_Surface"])
    b.box(v(0, DESK_FRONT + 0.04, 0.005 + panel_h / 2), (TABLE_W + 0.04, 0.08, panel_h), desk_mat)
    b.box(v(0, DESK_FRONT + 0.03, FASCIA_TOP - 0.02), (TABLE_W + 0.05, 0.108, 0.064), mats["M_Surface"])
    for s in (-1, 1):
        b.box(v(s * (TABLE_W / 2 - 0.04), desk_y, leg_h / 2), (0.06, desk_d - 0.04, leg_h), desk_mat)
        add_chair(b, Vector((s * SEAT.x, SEAT.y)), mats)
    b.box(v(0, DESK_BACK - 0.004, DESK_TOP - 0.02), (TABLE_W - 0.06, 0.012, 0.022), mats["M_Trim"])
    return b


def plate_builder(mat, origin):
    """Team nameplate: a band on the back of the front panel plus a panel on each table end, so
    the outer tables, which Cam_Main sees side-on, show it too."""
    b = MeshBuilder()
    b.box(v(0, DESK_FRONT - 0.003, PLATE_Z), (TABLE_W - 0.2, 0.01, PLATE_H), mat)
    for s in (-1, 1):
        b.box(v(s * (TABLE_W / 2 - 0.007), (DESK_BACK + DESK_FRONT) / 2, 0.55), (0.01, 0.56, 0.26), mat)
    b.transform(Matrix.Translation(-origin))
    return b


def uv_quad(name, width, height, mat):
    """A flat, UV-mapped rectangle facing -Y (toward Cam_Main): the app draws on it (team code on
    the nameplate), so the model itself carries no text."""
    hx, hz = width / 2, height / 2
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-hx, 0, -hz), (hx, 0, -hz), (hx, 0, hz), (-hx, 0, hz)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = coord
    mesh.materials.append(mat)
    return mesh


def paddle_blade(mat, yaw):
    """Round blade above a handle whose bottom is the origin; it faces local +-Y before `yaw`."""
    b = MeshBuilder()
    rim = [(0, -0.008), (0.145, -0.008), (0.15, -0.002), (0.15, 0.002), (0.145, 0.008), (0, 0.008)]
    frame = Matrix.Rotation(yaw, 4, "Z") @ Matrix.Translation((0, 0, 0.35)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    b.lathe(rim, mat, frame, segments=24)
    return b


def paddle_handle(mat):
    b = MeshBuilder()
    b.lathe([(0, 0), (0.017, 0), (0.017, 0.21), (0, 0.21)], mat, segments=10)
    return b


def build_tables(mats):
    for i, code in enumerate(TEAMS):
        angle = -ARC_SPAN / 2 + i * ARC_SPAN / (len(TEAMS) - 1)
        spot = arc_point(ARC_RADIUS, angle)
        yaw = yaw_towards(spot, TABLE_FOCUS)
        inward = 1 if spot.x < 0 else -1  # table end nearer the centre line, local X
        desk = table_builder(mats, make_material(f"M_Desk_{code}", *DESK_FINISH))
        table = mesh_object(f"Table_{code}", desk, location=v(*spot, 0), yaw=yaw, bevel=0.012)

        lamp_mat = make_material(f"M_Lamp_{code}", *LAMP_FINISH)
        lamp = MeshBuilder()
        lamp.box(v(0, 0, 0), (TABLE_W - 0.2, 0.06, 0.06), lamp_mat)
        mesh_object(f"Lamp_{code}", lamp, table, v(0, DESK_FRONT, FASCIA_TOP), bevel=0.01)

        plate_at = v(0, DESK_FRONT - 0.003, PLATE_Z)
        plate = plate_builder(make_material(f"M_Plate_{code}", *PLATE_FINISH), plate_at)
        mesh_object(f"Plate_{code}", plate, table, plate_at, bevel=0.003)
        lettering = uv_quad(f"PlateText_{code}", TABLE_W - 0.22, PLATE_H - 0.01,
                            make_material(f"M_PlateText_{code}", *PLATE_FINISH))
        add_object(f"PlateText_{code}", lettering, table, v(0, DESK_FRONT - 0.0095, PLATE_Z))

        # The blade is turned (in the mesh) toward Cam_Main so no paddle is seen edge-on.
        paddle_at = Vector((PADDLE_SPOT.x * inward, PADDLE_SPOT.y))
        to_camera = Matrix.Rotation(-yaw, 2) @ (CAM_POS.xy - (spot + Matrix.Rotation(yaw, 2) @ paddle_at))
        blade = paddle_blade(make_material(f"M_Paddle_{code}", *PADDLE_FINISH), yaw_towards(Vector((0, 0)), to_camera))
        paddle = mesh_object(f"Paddle_{code}", blade, table, v(*paddle_at, DESK_TOP))
        mesh_object(f"PaddleHandle_{code}", paddle_handle(mats["M_Handle"]), paddle)

        jersey = make_material(f"M_Jersey_{code}", *JERSEY_FINISH)
        sleeve = make_material(f"M_Sleeve_{code}", *JERSEY_FINISH)
        for n, side in ((1, -1), (2, 1)):
            body = MeshBuilder()
            add_body(body, seated_joints(hold_side=side if side == inward else 0), mats["M_Silhouette"],
                     shirt=jersey, sleeve=sleeve)
            mesh_object(f"Figure_{code}_{n}", body, table, v(side * SEAT.x, SEAT.y, 0))

        add_empty(f"Anchor_{code}", v(0, 0, DESK_TOP + ANCHOR_RISE), table)


def build_camera():
    data = bpy.data.cameras.new("Cam_Main")
    data.sensor_fit = "VERTICAL"
    data.angle_y = CAM_FOV_Y
    data.clip_start, data.clip_end = 0.1, 100.0
    cam = add_object("Cam_Main", data, location=CAM_POS)
    cam.rotation_euler = (CAM_TARGET - CAM_POS).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = make_materials()
    build_room(mats)
    build_stage(mats)
    build_screen(mats)
    build_podium(mats)
    build_hammer(mats)
    build_auctioneer(mats)
    build_silhouettes(mats)
    build_tables(mats)
    build_camera()


# --- output ------------------------------------------------------------------------------


def export_glb():
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=True,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_vertex_color="NONE",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )


def add_light(name, kind, location, target, energy, color=(1, 1, 1), **settings):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    for key, value in settings.items():
        setattr(data, key, value)
    obj = add_object(name, data, location=location)
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()


def light_preview():
    """Stand-in soft studio lighting for the preview only; it is added after the export."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Preview")
    scene.world = world
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0.92, 0.93, 0.95, 1)
    background.inputs["Strength"].default_value = 0.26

    add_light("Key", "AREA", (-6, -13, 12), (0, -2, 0), 1700, shape="RECTANGLE", size=7, size_y=4)
    add_light("StageWash", "AREA", (4, -5, 9), (0, 2.5, 1.5), 550, shape="RECTANGLE", size=8, size_y=3)
    add_light("Fill", "AREA", (9, -19, 5), (0, -6, 1), 250, size=6)
    scene.eevee.use_fast_gi = True
    scene.eevee.fast_gi_method = "GLOBAL_ILLUMINATION"
    scene.eevee.fast_gi_distance = 1.5
    scene.eevee.use_raytracing = True
    scene.eevee.taa_render_samples = 64
    scene.view_settings.view_transform = "Khronos PBR Neutral"


def tint_preview_teams():
    """Apply real team colours for the preview only; the exported GLB keeps neutral defaults."""
    for code, (primary, secondary) in PREVIEW_TEAM_COLOURS.items():
        for name, color in ((f"M_Desk_{code}", primary), (f"M_Plate_{code}", secondary), (f"M_Paddle_{code}", primary),
                            (f"M_Jersey_{code}", primary), (f"M_Sleeve_{code}", secondary)):
            principled(bpy.data.materials[name]).inputs["Base Color"].default_value = (*srgb_to_linear(color), 1.0)


def render_preview():
    light_preview()
    tint_preview_teams()
    scene = bpy.context.scene
    for name in ("Silhouette_Bowler", "Silhouette_Keeper"):  # the app shows one cricketer at a time
        bpy.data.objects[name].hide_render = True
    scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)


def main():
    build_scene()
    export_glb()
    render_preview()
    print(f"room.glb: {GLB_PATH.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
