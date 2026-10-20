#!/usr/bin/env python3
"""
3D Environmental Design & Cartographic Visualization Engine
TripPlanner 2.5D Isometric Diorama Generator

Transforms geographic, spatial, and point-of-interest (POI) parameters into an authentic,
tactile 3D isometric diorama scene using Headless Blender 5.x and Cycles Metal GPU rendering.
"""

import sys
import os
import math
import json
import argparse
from mathutils import Vector, Euler

try:
    import bpy
except ImportError:
    print("Error: This script must be run inside Blender: blender -b -P scripts/diorama_engine.py -- [args]")
    sys.exit(1)


# ==============================================================================
# 1. SHADER & MATERIAL FACTORY (Tactile, Physical Aesthetics)
# ==============================================================================

def create_principled_material(name, **kwargs):
    """Creates a high-fidelity Principled BSDF material in Blender 5.x."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    # Defaults
    if not bsdf:
        return mat
        
    for k, v in kwargs.items():
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
            
    return mat


def create_geological_strata_material():
    """
    Creates a layered cross-section procedural shader for exposed cliffside edges:
    - Top layer: Rich fertile topsoil
    - Middle layer: Stratified sedimentary sandstone / limestone
    - Bottom layer: Deep dark crystalline bedrock with micro-displacement
    """
    mat = bpy.data.materials.new(name="Mat_Geological_Strata")
    mat.use_nodes = True
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    # Texture Coordinate -> Mapping -> Separate XYZ (Z position controls strata layers)
    tex_coord = nodes.new(type="ShaderNodeTexCoord")
    mapping = nodes.new(type="ShaderNodeMapping")
    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
    
    sep_xyz = nodes.new(type="ShaderNodeSeparateXYZ")
    links.new(mapping.outputs["Vector"], sep_xyz.inputs["Vector"])
    
    # Noise texture for organic strata waviness
    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 12.0
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.6
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    
    # Math node to perturb Z coordinate slightly with noise
    math_perturb = nodes.new(type="ShaderNodeMath")
    math_perturb.operation = 'MULTIPLY_ADD'
    math_perturb.inputs[1].default_value = 0.12  # Noise amplitude
    links.new(noise.outputs["Fac"], math_perturb.inputs[0])
    links.new(sep_xyz.outputs["Z"], math_perturb.inputs[2])
    
    # Color Ramp for Strata:
    # Z < -1.8: Deep Bedrock (#1F1F26)
    # Z ~ -1.2 to -0.6: Sandstone Banding (#7A654C, #A88F6D, #5E4E3A)
    # Z > -0.3: Dark Topsoil (#332417)
    ramp = nodes.new(type="ShaderNodeValToRGB")
    elements = ramp.color_ramp.elements
    elements[0].position = 0.0
    elements[0].color = (0.12, 0.12, 0.15, 1.0)  # Bedrock
    
    el1 = elements.new(0.35)
    el1.color = (0.28, 0.22, 0.17, 1.0)  # Lower shale
    
    el2 = elements.new(0.60)
    el2.color = (0.52, 0.43, 0.32, 1.0)  # Sandstone layer
    
    el3 = elements.new(0.78)
    el3.color = (0.38, 0.30, 0.22, 1.0)  # Transition
    
    elements[1].position = 1.0
    elements[1].color = (0.18, 0.13, 0.08, 1.0)  # Topsoil
    
    # Remap Z (-3.0 to 0.0) into 0.0 to 1.0 for Color Ramp
    map_range = nodes.new(type="ShaderNodeMapRange")
    map_range.inputs["From Min"].default_value = -3.0
    map_range.inputs["From Max"].default_value = 0.0
    map_range.inputs["To Min"].default_value = 0.0
    map_range.inputs["To Max"].default_value = 1.0
    links.new(math_perturb.outputs["Value"], map_range.inputs["Value"])
    links.new(map_range.outputs["Result"], ramp.inputs["Fac"])
    
    # Principled BSDF
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.85
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    
    # Bump for tactile rock roughness
    bump = nodes.new(type="ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.1
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    
    return mat


def create_resin_water_material():
    """Glossy transparent jewel-resin water material with deep teal absorption."""
    mat = bpy.data.materials.new(name="Mat_Resin_Water")
    mat.use_nodes = True
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    # In Blender 5.x: Transmission Weight for glass/resin
    bsdf.inputs["Base Color"].default_value = (0.05, 0.35, 0.45, 1.0)  # Vibrant cyan-teal
    bsdf.inputs["Roughness"].default_value = 0.03
    bsdf.inputs["IOR"].default_value = 1.333
    bsdf.inputs["Transmission Weight"].default_value = 0.95
    bsdf.inputs["Coat Weight"].default_value = 0.4
    bsdf.inputs["Coat Roughness"].default_value = 0.02
    
    # Subtle procedural water ripples
    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 24.0
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.3
    
    bump = nodes.new(type="ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.04
    bump.inputs["Distance"].default_value = 0.05
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def create_frosted_acrylic_hud_material():
    """Physical skeuomorphic / frosted glassmorphic HUD slab material."""
    mat = bpy.data.materials.new(name="Mat_Frosted_HUD")
    mat.use_nodes = True
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.88, 0.94, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.22  # Satin frosted diffusion
    bsdf.inputs["IOR"].default_value = 1.48
    bsdf.inputs["Transmission Weight"].default_value = 0.88
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    bsdf.inputs["Emission Color"].default_value = (0.0, 0.7, 0.9, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.15  # Soft ambient inner edge glow
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def create_route_neon_ribbon_material():
    """Volumetric glowing neon/LED glass ribbon material for route path."""
    mat = bpy.data.materials.new(name="Mat_Route_Neon_Ribbon")
    mat.use_nodes = True
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.9, 1.0, 1.0)  # Electric cyan
    bsdf.inputs["Roughness"].default_value = 0.15
    bsdf.inputs["Transmission Weight"].default_value = 0.75
    bsdf.inputs["Emission Color"].default_value = (0.05, 0.85, 1.0, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 4.5  # High-intensity neon glow
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


# ==============================================================================
# 2. SCENE INITIALIZATION & CAMERA SETUP
# ==============================================================================

def setup_diorama_scene(resolution=(1920, 1080), samples=64, use_metal=True):
    """Initializes a pristine Blender scene calibrated for physical isometric rendering."""
    # Wipe scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    for coll in [bpy.data.materials, bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.curves]:
        for block in list(coll):
            coll.remove(block)
            
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    
    # Metal GPU device configuration
    if use_metal:
        try:
            cycles_prefs = bpy.context.preferences.addons['cycles'].preferences
            cycles_prefs.compute_device_type = 'METAL'
            cycles_prefs.get_devices()
            has_gpu = False
            for dev in cycles_prefs.devices:
                if dev.type == 'METAL':
                    dev.use = True
                    has_gpu = True
                    print(f"[Engine] Enabled Metal GPU: {dev.name}")
            if has_gpu:
                scene.cycles.device = 'GPU'
            else:
                scene.cycles.device = 'CPU'
        except Exception as e:
            print(f"[Engine] Warning: Metal initialization fallback to CPU ({e})")
            scene.cycles.device = 'CPU'
    else:
        scene.cycles.device = 'CPU'
        
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.film_transparent = True  # Transparent outer canvas for crisp UI integration
    
    # 45-degree elevated Isometric Camera
    # Exact true isometric angles:
    # Camera at (14, -14, 12), pointing toward origin (0, 0, 0)
    cam_data = bpy.data.cameras.new("Diorama_Isometric_Camera")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 17.5  # Frames chunk base + floating HUD comfortably
    
    # Enable subtle tilt-shift depth of field for miniature world aesthetic
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = 22.0
    cam_data.dof.aperture_fstop = 8.0  # Subtle miniature tilt-shift blur on corners
    
    cam_obj = bpy.data.objects.new("Diorama_Isometric_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Rotation: Tilted 54.736 deg along X, 0 along Y, 45 deg along Z
    cam_obj.location = Vector((14.0, -14.0, 12.5))
    cam_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    
    # Studio & Sun Lighting
    # 1. Warm Directional Sunlight
    sun_data = bpy.data.lights.new(name="Sun_KeyLight", type='SUN')
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.96, 0.90)  # Golden morning sunlight
    sun_data.angle = math.radians(6.5)   # Soft realistic shadow boundaries
    sun_obj = bpy.data.objects.new("Sun_KeyLight", sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.location = Vector((6.0, -8.0, 14.0))
    sun_obj.rotation_euler = Euler((math.radians(48.0), math.radians(22.0), math.radians(35.0)), 'XYZ')
    
    # 2. Cool Sky Fill Light (Hemispheric contrast)
    sky_data = bpy.data.lights.new(name="Sky_FillLight", type='SUN')
    sky_data.energy = 1.6
    sky_data.color = (0.82, 0.90, 1.0)  # Atmospheric sky blue
    sky_data.angle = math.radians(15.0)
    sky_obj = bpy.data.objects.new("Sky_FillLight", sky_data)
    scene.collection.objects.link(sky_obj)
    sky_obj.location = Vector((-8.0, 8.0, 12.0))
    sky_obj.rotation_euler = Euler((math.radians(120.0), 0.0, math.radians(-45.0)), 'XYZ')
    
    # 3. Soft Under-Rim Light (Accentuates floating chunk cliff edges)
    rim_data = bpy.data.lights.new(name="Chunk_RimLight", type='AREA')
    rim_data.energy = 80.0
    rim_data.size = 12.0
    rim_data.color = (0.7, 0.8, 1.0)
    rim_obj = bpy.data.objects.new("Chunk_RimLight", rim_data)
    scene.collection.objects.link(rim_obj)
    rim_obj.location = Vector((0.0, 0.0, -4.5))
    rim_obj.rotation_euler = Euler((math.radians(180.0), 0.0, 0.0), 'XYZ')
    
    return scene


# ==============================================================================
# 3. "CHUNK" / CROSS-SECTION BASE & TOPOGRAPHY
# ==============================================================================

def create_floating_chunk_base(width=10.0, length=10.0, base_depth=2.4):
    """
    Constructs the self-contained floating rectangular soil/rock block or architectural slice.
    Exposes geological strata along the cliffside edges and a textured topsoil surface.
    """
    # 1. Main Subterranean Block (-base_depth to 0.0)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    base_obj = bpy.context.active_object
    base_obj.name = "Chunk_Subterranean_Base"
    base_obj.scale = (width, length, base_depth)
    base_obj.location = (0.0, 0.0, -base_depth / 2.0)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    strata_mat = create_geological_strata_material()
    base_obj.data.materials.append(strata_mat)
    
    # 2. Beveled Edge Frame / Architectural Rim
    bpy.ops.object.modifier_add(type='BEVEL')
    bev = base_obj.modifiers["Bevel"]
    bev.width = 0.08
    bev.segments = 3
    
    # 3. Top Terrain Ground Surface (Z = 0.0)
    # Lush grass / moss ground plane
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    ground_obj = bpy.context.active_object
    ground_obj.name = "Terrain_Surface_Ground"
    ground_obj.scale = (width - 0.04, length - 0.04, 1.0)
    ground_obj.location = (0.0, 0.0, 0.005)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    mat_ground = create_principled_material(
        "Mat_Terrain_Moss",
        **{
            "Base Color": (0.22, 0.38, 0.20, 1.0),  # Rich Japanese garden moss
            "Roughness": 0.75,
            "Subsurface Weight": 0.25,
            "Subsurface Radius": (0.4, 0.7, 0.2),
        }
    )
    ground_obj.data.materials.append(mat_ground)
    
    # 4. Perimeter Mountain Contours & Terraced Hills (Kyoto Higashiyama style)
    # Adds subtle elevation contours along the east/north edges
    hill_coords = [
        (4.2, 3.8, 0.8, 1.6),
        (3.5, 4.2, 0.6, 1.8),
        (4.5, 1.8, 0.9, 1.4),
        (4.0, -1.2, 0.7, 1.5),
        (-4.0, 3.8, 0.5, 1.4),
    ]
    mat_rock = create_principled_material("Mat_Terrace_Rock", **{"Base Color": (0.35, 0.36, 0.34, 1.0), "Roughness": 0.85})
    for i, (hx, hy, hz, r) in enumerate(hill_coords):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=hz, location=(hx, hy, hz/2.0))
        hill = bpy.context.active_object
        hill.name = f"Terrain_Contour_Hill_{i+1}"
        hill.data.materials.append(mat_ground)
        # Add bevel modifier for terraced steps
        bpy.ops.object.modifier_add(type='BEVEL')
        hill.modifiers["Bevel"].width = 0.15
        hill.modifiers["Bevel"].segments = 2
        
    return base_obj


def create_river_water_cross_section(width=10.0, river_width=1.4, river_depth=0.35):
    """
    Carves a winding river channel (e.g. Kamo River) cutting through the terrain surface
    and revealing a clear glossy resin cross-section at the bounding cliff edges.
    """
    # River canal block slicing across from North to South (Y = -5 to +5) with subtle curve
    mat_water = create_resin_water_material()
    mat_riverbed = create_principled_material("Mat_Riverbed_Pebbles", **{"Base Color": (0.28, 0.27, 0.24, 1.0), "Roughness": 0.9})
    
    # River Water Body
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    water_obj = bpy.context.active_object
    water_obj.name = "River_Resin_Channel"
    water_obj.scale = (river_width, width, river_depth)
    water_obj.location = (-0.8, 0.0, -river_depth / 2.0)
    bpy.ops.object.transform_apply(location=True, scale=True)
    water_obj.data.materials.append(mat_water)
    
    # Stepping stones / bridge pylons crossing river
    mat_stone = create_principled_material("Mat_Stepping_Stone", **{"Base Color": (0.42, 0.43, 0.44, 1.0), "Roughness": 0.7})
    for sy in [-2.5, 0.2, 2.8]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18, depth=0.1, location=(-0.8, sy, 0.03))
        stone = bpy.context.active_object
        stone.name = f"River_Stepping_Stone_{sy}"
        stone.data.materials.append(stone_mat := mat_stone)
        
    # Miniature Arched Wooden/Concrete Bridge across the river
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bridge = bpy.context.active_object
    bridge.name = "Bridge_Kamo_Crossing"
    bridge.scale = (river_width + 0.6, 0.45, 0.08)
    bridge.location = (-0.8, 0.5, 0.06)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    mat_bridge = create_principled_material("Mat_Bridge_Vermilion", **{"Base Color": (0.75, 0.22, 0.14, 1.0), "Roughness": 0.4})
    bridge.data.materials.append(mat_bridge)
    
    # Bridge handrails
    for side in [-0.2, 0.2]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        rail = bpy.context.active_object
        rail.name = f"Bridge_Rail_{side}"
        rail.scale = (river_width + 0.6, 0.04, 0.12)
        rail.location = (-0.8, 0.5 + side, 0.14)
        bpy.ops.object.transform_apply(location=True, scale=True)
        rail.data.materials.append(mat_bridge)


# ==============================================================================
# 4. INFRASTRUCTURE, ROADS & MINIATURE CITY BLOCKS
# ==============================================================================

def create_road_corridors_and_blocks():
    """
    Renders detailed 3D miniature asphalt road corridors with crisp curbs,
    and surrounding low-rise procedural urban architecture (machiya townhouses).
    """
    mat_asphalt = create_principled_material("Mat_Road_Asphalt", **{"Base Color": (0.16, 0.17, 0.19, 1.0), "Roughness": 0.75})
    mat_curb = create_principled_material("Mat_Road_Curb", **{"Base Color": (0.68, 0.70, 0.72, 1.0), "Roughness": 0.6})
    mat_machiya_wood = create_principled_material("Mat_Machiya_Wood", **{"Base Color": (0.28, 0.19, 0.12, 1.0), "Roughness": 0.8})
    mat_machiya_roof = create_principled_material("Mat_Machiya_Roof", **{"Base Color": (0.18, 0.20, 0.24, 1.0), "Roughness": 0.45})
    mat_window_glow = create_principled_material("Mat_Window_Glow", **{"Base Color": (1.0, 0.85, 0.5, 1.0), "Emission Color": (1.0, 0.85, 0.5, 1.0), "Emission Strength": 2.5})
    
    # Primary Artery 1: Main East-West Boulevard (crossing bridge at Y=0.5)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ew = bpy.context.active_object
    road_ew.name = "Road_Boulevard_EW"
    road_ew.scale = (9.2, 0.55, 0.02)
    road_ew.location = (0.0, 0.5, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ew.data.materials.append(mat_asphalt)
    
    # Primary Artery 2: North-South Avenue (East side of river)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ns1 = bpy.context.active_object
    road_ns1.name = "Road_Avenue_NS_East"
    road_ns1.scale = (0.45, 9.2, 0.02)
    road_ns1.location = (1.5, 0.0, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ns1.data.materials.append(mat_asphalt)
    
    # Primary Artery 3: North-South Avenue (West side of river)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ns2 = bpy.context.active_object
    road_ns2.name = "Road_Avenue_NS_West"
    road_ns2.scale = (0.45, 9.2, 0.02)
    road_ns2.location = (-3.0, 0.0, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ns2.data.materials.append(mat_asphalt)
    
    # Miniature City Blocks: Traditional Machiya Townhouses & Low-rise Buildings
    building_clusters = [
        # Downtown Kyoto / Nakagyo grid (West of river)
        (-2.2, -1.2, 0.4, 0.5, 0.45),
        (-2.2, -2.0, 0.35, 0.6, 0.5),
        (-2.2, 1.4, 0.45, 0.5, 0.6),
        (-2.2, 2.3, 0.4, 0.7, 0.4),
        (-3.8, -1.0, 0.5, 0.5, 0.65),
        (-3.8, 1.2, 0.4, 0.6, 0.5),
        # Gion & Higashiyama quarters (East of river)
        (0.6, -1.4, 0.35, 0.5, 0.45),
        (0.6, -2.2, 0.4, 0.45, 0.4),
        (0.6, 1.5, 0.35, 0.6, 0.5),
        (2.4, -0.6, 0.45, 0.55, 0.45),
        (2.4, 1.4, 0.5, 0.6, 0.55),
        (2.4, 2.4, 0.4, 0.5, 0.4),
    ]
    
    for i, (bx, by, bw, bl, bh) in enumerate(building_clusters):
        # Base walls
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        bld = bpy.context.active_object
        bld.name = f"CityBlock_Bld_{i+1}"
        bld.scale = (bw, bl, bh)
        bld.location = (bx, by, bh / 2.0 + 0.01)
        bpy.ops.object.transform_apply(location=True, scale=True)
        bld.data.materials.append(mat_machiya_wood)
        
        # Pitched Japanese tile roof
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=max(bw, bl) * 0.75, depth=0.15, location=(bx, by, bh + 0.08))
        roof = bpy.context.active_object
        roof.name = f"CityBlock_Roof_{i+1}"
        roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
        roof.data.materials.append(mat_machiya_roof)
        
    # Miniature Autumn Momiji & Pine Trees (Foliage accents)
    tree_spots = [
        # Along riverbank
        (-0.1, -3.2, 0.35, "momiji"),
        (-0.1, -1.8, 0.4, "pine"),
        (-0.1, 1.8, 0.38, "momiji"),
        (-0.1, 3.4, 0.42, "momiji"),
        (-1.5, -3.5, 0.35, "pine"),
        (-1.5, 2.5, 0.38, "momiji"),
        # Hillside temple forest
        (3.8, 3.2, 0.55, "momiji"),
        (4.4, 2.4, 0.48, "momiji"),
        (4.2, 0.8, 0.5, "pine"),
        (3.6, -2.8, 0.5, "pine"),
        (4.2, -3.4, 0.45, "momiji"),
    ]
    
    mat_momiji = create_principled_material(
        "Mat_Momiji_Red",
        **{
            "Base Color": (0.85, 0.18, 0.12, 1.0),
            "Roughness": 0.65,
            "Subsurface Weight": 0.4,
            "Subsurface Radius": (0.8, 0.2, 0.1),
        }
    )
    mat_pine = create_principled_material(
        "Mat_Pine_Green",
        **{
            "Base Color": (0.12, 0.28, 0.16, 1.0),
            "Roughness": 0.7,
            "Subsurface Weight": 0.3,
            "Subsurface Radius": (0.2, 0.6, 0.2),
        }
    )
    
    for i, (tx, ty, tr, ttype) in enumerate(tree_spots):
        # Canopy (deformed icosphere)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=tr, location=(tx, ty, tr + 0.15))
        canopy = bpy.context.active_object
        canopy.name = f"Foliage_Canopy_{i+1}"
        canopy.data.materials.append(mat_momiji if ttype == "momiji" else mat_pine)
        # Trunk
        bpy.ops.mesh.primitive_cylinder_add(radius=tr * 0.2, depth=0.3, location=(tx, ty, 0.15))
        trunk = bpy.context.active_object
        trunk.name = f"Foliage_Trunk_{i+1}"
        trunk.data.materials.append(mat_machiya_wood)


# ==============================================================================
# 5. SELECTIVELY ENLARGED 3D ARCHITECTURAL POIS
# ==============================================================================

def build_shinto_torii_and_shrine(x=2.5, y=-3.2, z=0.0):
    """
    Constructs an authentic, selectively enlarged 3D model of Fushimi Inari Taisha:
    - Vermilion Grand Torii Gate arch with black lintel top
    - Shinto Shrine Hall (Honden) with curved gables and golden chigi roof finials
    - Stepped mountain approach path with miniature Torii tunnel
    """
    parent = bpy.data.objects.new("POI_Fushimi_Inari", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_vermilion = create_principled_material(
        "Mat_Torii_Vermilion",
        **{
            "Base Color": (0.88, 0.18, 0.08, 1.0),  # Authentic Fushimi Inari orange-red
            "Roughness": 0.25,
            "Specular IOR Level": 0.5,
        }
    )
    mat_gold = create_principled_material("Mat_Gold_Finial", **{"Base Color": (0.95, 0.78, 0.25, 1.0), "Metallic": 0.9, "Roughness": 0.18})
    mat_cypress_roof = create_principled_material("Mat_Shrine_Bark_Roof", **{"Base Color": (0.16, 0.14, 0.13, 1.0), "Roughness": 0.75})
    mat_lantern_glow = create_principled_material("Mat_Shoji_Glow", **{"Base Color": (1.0, 0.92, 0.7, 1.0), "Emission Color": (1.0, 0.88, 0.6, 1.0), "Emission Strength": 3.0})
    
    # 1. Grand Torii Gate (Selectively enlarged landmark focal point)
    col_radius = 0.08
    col_height = 1.3
    # Two main pillars
    for px in [-0.45, 0.45]:
        bpy.ops.mesh.primitive_cylinder_add(radius=col_radius, depth=col_height, location=(x + px, y, z + col_height/2.0))
        col = bpy.context.active_object
        col.name = f"Torii_Pillar_{px}"
        col.data.materials.append(mat_vermilion)
        col.parent = parent
        
    # Lower Crossbeam (Nuki)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    nuki = bpy.context.active_object
    nuki.name = "Torii_Nuki"
    nuki.scale = (1.1, 0.08, 0.1)
    nuki.location = (x, y, z + 0.95)
    bpy.ops.object.transform_apply(location=True, scale=True)
    nuki.data.materials.append(mat_vermilion)
    nuki.parent = parent
    
    # Upper Curved Crossbeam (Kasagi & Shimaki) with black lintel top
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    kasagi = bpy.context.active_object
    kasagi.name = "Torii_Kasagi"
    kasagi.scale = (1.35, 0.12, 0.14)
    kasagi.location = (x, y, z + col_height + 0.05)
    bpy.ops.object.transform_apply(location=True, scale=True)
    kasagi.data.materials.append(mat_vermilion)
    kasagi.parent = parent
    
    # Black top roof strip
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    roof_cap = bpy.context.active_object
    roof_cap.name = "Torii_Roof_Cap"
    roof_cap.scale = (1.38, 0.14, 0.04)
    roof_cap.location = (x, y, z + col_height + 0.13)
    bpy.ops.object.transform_apply(location=True, scale=True)
    roof_cap.data.materials.append(mat_cypress_roof)
    roof_cap.parent = parent
    
    # 2. Main Shrine Hall (Honden) behind the gate
    hall_x, hall_y, hall_z = x, y - 0.75, z
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hall = bpy.context.active_object
    hall.name = "Shrine_Honden_Hall"
    hall.scale = (0.9, 0.8, 0.6)
    hall.location = (hall_x, hall_y, hall_z + 0.3)
    bpy.ops.object.transform_apply(location=True, scale=True)
    hall.data.materials.append(mat_vermilion)
    hall.parent = parent
    
    # Glowing Shoji Screen Sanctuary
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    shoji = bpy.context.active_object
    shoji.name = "Shrine_Shoji_Screen"
    shoji.scale = (0.6, 0.05, 0.35)
    shoji.location = (hall_x, hall_y + 0.38, hall_z + 0.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    shoji.data.materials.append(mat_lantern_glow)
    shoji.parent = parent
    
    # Sweeping Gabled Roof
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.85, depth=0.35, location=(hall_x, hall_y, hall_z + 0.75))
    shrine_roof = bpy.context.active_object
    shrine_roof.name = "Shrine_Gabled_Roof"
    shrine_roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    shrine_roof.data.materials.append(mat_cypress_roof)
    shrine_roof.parent = parent
    
    # Golden Chigi Finials on Ridge
    for fx in [-0.35, 0.35]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.25, location=(hall_x + fx, hall_y, hall_z + 0.95))
        chigi = bpy.context.active_object
        chigi.name = f"Shrine_Chigi_{fx}"
        chigi.rotation_euler = Euler((0.0, math.radians(35.0 if fx > 0 else -35.0), 0.0), 'XYZ')
        chigi.data.materials.append(mat_gold)
        chigi.parent = parent
        
    # 3. Senbon Torii Tunnel (Curving miniature red gates climbing the hillside)
    for idx, (tx, ty) in enumerate([(0.5, 0.3), (0.7, 0.6), (0.9, 0.9), (1.1, 1.2)]):
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        t_gate = bpy.context.active_object
        t_gate.name = f"Senbon_Torii_Mini_{idx}"
        t_gate.scale = (0.35, 0.05, 0.45)
        t_gate.location = (x + tx, y + ty, z + idx * 0.08 + 0.22)
        bpy.ops.object.transform_apply(location=True, scale=True)
        t_gate.data.materials.append(mat_vermilion)
        t_gate.parent = parent
        
    return parent


def build_kiyomizu_dera_complex(x=3.8, y=2.8, z=0.7):
    """
    Constructs an authentic, selectively enlarged 3D architectural model of Kiyomizu-dera:
    - Historic cantilevered wooden stage (`kakezukuri`) supported by interlocking timber scaffolding
    - Multi-tiered main worship hall with curved eaves
    - Vibrant red 3-story pagoda with golden brass spire (`sorin`)
    - Perched on a cliff edge with autumn momiji surrounding the foundation
    """
    parent = bpy.data.objects.new("POI_Kiyomizu_Dera", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_timber = create_principled_material("Mat_Kiyomizu_Veranda_Timber", **{"Base Color": (0.32, 0.22, 0.14, 1.0), "Roughness": 0.85})
    mat_temple_roof = create_principled_material("Mat_Temple_Bark_Thatch", **{"Base Color": (0.17, 0.16, 0.15, 1.0), "Roughness": 0.7})
    mat_pagoda_red = create_principled_material("Mat_Pagoda_Lacquered_Red", **{"Base Color": (0.82, 0.16, 0.10, 1.0), "Roughness": 0.3})
    mat_gold_spire = create_principled_material("Mat_Pagoda_Sorin_Gold", **{"Base Color": (0.92, 0.75, 0.22, 1.0), "Metallic": 0.85, "Roughness": 0.2})
    mat_lantern = create_principled_material("Mat_Temple_Lantern_Glow", **{"Base Color": (1.0, 0.9, 0.6, 1.0), "Emission Color": (1.0, 0.85, 0.5, 1.0), "Emission Strength": 3.5})
    
    # 1. Kakezukuri Timber Scaffolding Pillars (Under the main stage)
    # 4 rows of 3 vertical pillars with cross-beams
    for r in [-0.4, -0.15, 0.1, 0.35]:
        for c in [-0.3, 0.0, 0.3]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.8, location=(x + r, y + c, z - 0.2))
            pillar = bpy.context.active_object
            pillar.name = f"Kiyomizu_Pillar_{r}_{c}"
            pillar.data.materials.append(mat_timber)
            pillar.parent = parent
            
    # Horizontal Interlocking Crossbeams
    for r in [-0.4, 0.0, 0.35]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        beam = bpy.context.active_object
        beam.name = f"Kiyomizu_Crossbeam_{r}"
        beam.scale = (0.85, 0.05, 0.05)
        beam.location = (x, y + (r * 0.8), z - 0.25)
        bpy.ops.object.transform_apply(location=True, scale=True)
        beam.data.materials.append(mat_timber)
        beam.parent = parent
        
    # 2. Cantilevered Stage Veranda (The famous scenic platform)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    stage = bpy.context.active_object
    stage.name = "Kiyomizu_Scenic_Stage"
    stage.scale = (1.0, 0.8, 0.06)
    stage.location = (x - 0.1, y, z + 0.2)
    bpy.ops.object.transform_apply(location=True, scale=True)
    stage.data.materials.append(mat_timber)
    stage.parent = parent
    
    # Stage Railing
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    railing = bpy.context.active_object
    railing.name = "Kiyomizu_Stage_Railing"
    railing.scale = (0.05, 0.78, 0.12)
    railing.location = (x - 0.58, y, z + 0.28)
    bpy.ops.object.transform_apply(location=True, scale=True)
    railing.data.materials.append(mat_timber)
    railing.parent = parent
    
    # 3. Main Temple Hall Structure
    hall_x, hall_y, hall_z = x + 0.25, y, z + 0.23
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hall = bpy.context.active_object
    hall.name = "Kiyomizu_Main_Hall"
    hall.scale = (0.7, 0.75, 0.5)
    hall.location = (hall_x, hall_y, hall_z + 0.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    hall.data.materials.append(mat_timber)
    hall.parent = parent
    
    # Warm Lantern Glow under the eave
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    lantern = bpy.context.active_object
    lantern.name = "Kiyomizu_Eave_Lantern"
    lantern.scale = (0.08, 0.08, 0.14)
    lantern.location = (hall_x - 0.38, hall_y, hall_z + 0.35)
    bpy.ops.object.transform_apply(location=True, scale=True)
    lantern.data.materials.append(mat_lantern)
    lantern.parent = parent
    
    # Massive Sweeping Temple Roof (Hip-and-Gable Japanese Thatch)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.95, depth=0.45, location=(hall_x, hall_y, hall_z + 0.65))
    roof = bpy.context.active_object
    roof.name = "Kiyomizu_Hall_Roof"
    roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    roof.data.materials.append(mat_temple_roof)
    roof.parent = parent
    
    # 4. Adjacent 3-Story Pagoda Tower (Sanjunoto)
    pagoda_x, pagoda_y = x + 0.8, y - 0.6
    for tier in range(3):
        tz = z + 0.2 + tier * 0.35
        # Tier wall
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        tw = bpy.context.active_object
        tw.name = f"Pagoda_Tier_{tier+1}_Wall"
        tw.scale = (0.42 - tier * 0.06, 0.42 - tier * 0.06, 0.22)
        tw.location = (pagoda_x, pagoda_y, tz + 0.11)
        bpy.ops.object.transform_apply(location=True, scale=True)
        tw.data.materials.append(mat_pagoda_red)
        tw.parent = parent
        
        # Tier flared eave roof
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.55 - tier * 0.08, depth=0.12, location=(pagoda_x, pagoda_y, tz + 0.25))
        tr = bpy.context.active_object
        tr.name = f"Pagoda_Tier_{tier+1}_Roof"
        tr.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
        tr.data.materials.append(mat_temple_roof)
        tr.parent = parent
        
    # Pagoda Brass Spire (Sorin) on top
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.45, location=(pagoda_x, pagoda_y, z + 1.45))
    sorin = bpy.context.active_object
    sorin.name = "Pagoda_Sorin_Spire"
    sorin.data.materials.append(mat_gold_spire)
    sorin.parent = parent
    
    return parent


def build_kinkaku_ji_golden_pavilion(x=-2.8, y=3.2, z=0.0):
    """
    Constructs an authentic, selectively enlarged 3D architectural model of Kinkaku-ji (Golden Pavilion):
    - Ground floor natural cypress wood style (Shinden-zukuri)
    - 2nd and 3rd floors covered in radiant gold leaf (Buke-zukuri and Zen style)
    - Gilded Fenghuang Phoenix finial perched on roof peak
    - Perched beside a reflective placid mirror pond
    """
    parent = bpy.data.objects.new("POI_Kinkaku_Ji", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_gold_leaf = create_principled_material(
        "Mat_Kinkaku_GoldLeaf",
        **{
            "Base Color": (0.98, 0.82, 0.28, 1.0),
            "Metallic": 0.95,
            "Roughness": 0.14,
            "Coat Weight": 0.5,
        }
    )
    mat_wood_first = create_principled_material("Mat_Kinkaku_Wood_FirstFloor", **{"Base Color": (0.42, 0.32, 0.22, 1.0), "Roughness": 0.7})
    mat_roof_shingle = create_principled_material("Mat_Kinkaku_Roof_Shingle", **{"Base Color": (0.24, 0.20, 0.16, 1.0), "Roughness": 0.65})
    
    # Mirror Pond reflective basin around the pavilion
    mat_water = create_resin_water_material()
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.3, depth=0.06, location=(x + 0.3, y - 0.2, z + 0.02))
    pond = bpy.context.active_object
    pond.name = "Kinkaku_Mirror_Pond"
    pond.data.materials.append(mat_water)
    pond.parent = parent
    
    # 1st Floor (The Chamber of Dharma Waters - Natural wood & white plaster)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    f1 = bpy.context.active_object
    f1.name = "Kinkaku_Floor_1"
    f1.scale = (0.75, 0.65, 0.35)
    f1.location = (x, y, z + 0.2)
    bpy.ops.object.transform_apply(location=True, scale=True)
    f1.data.materials.append(mat_wood_first)
    f1.parent = parent
    
    # 1st Floor Eave
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.88, depth=0.1, location=(x, y, z + 0.42))
    eave1 = bpy.context.active_object
    eave1.name = "Kinkaku_Eave_1"
    eave1.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    eave1.data.materials.append(mat_roof_shingle)
    eave1.parent = parent
    
    # 2nd Floor (The Tower of Sound Waves - Gold leaf walls with Buddha shrine)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    f2 = bpy.context.active_object
    f2.name = "Kinkaku_Floor_2"
    f2.scale = (0.62, 0.52, 0.32)
    f2.location = (x, y, z + 0.58)
    bpy.ops.object.transform_apply(location=True, scale=True)
    f2.data.materials.append(mat_gold_leaf)
    f2.parent = parent
    
    # 2nd Floor Eave
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.75, depth=0.1, location=(x, y, z + 0.78))
    eave2 = bpy.context.active_object
    eave2.name = "Kinkaku_Eave_2"
    eave2.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    eave2.data.materials.append(mat_roof_shingle)
    eave2.parent = parent
    
    # 3rd Floor (Cupola of the Ultimate - Gilded Zen style with round arched windows)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    f3 = bpy.context.active_object
    f3.name = "Kinkaku_Floor_3"
    f3.scale = (0.45, 0.42, 0.28)
    f3.location = (x, y, z + 0.95)
    bpy.ops.object.transform_apply(location=True, scale=True)
    f3.data.materials.append(mat_gold_leaf)
    f3.parent = parent
    
    # Pyramid Roof
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.6, depth=0.3, location=(x, y, z + 1.22))
    roof = bpy.context.active_object
    roof.name = "Kinkaku_Pyramid_Roof"
    roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    roof.data.materials.append(mat_roof_shingle)
    roof.parent = parent
    
    # Golden Phoenix Finial on top
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.08, depth=0.16, location=(x, y, z + 1.45))
    phoenix = bpy.context.active_object
    phoenix.name = "Kinkaku_Golden_Phoenix"
    phoenix.data.materials.append(mat_gold_leaf)
    phoenix.parent = parent
    
    return parent


def build_kyoto_station_modern_hub(x=-1.5, y=-2.8, z=0.0):
    """
    Constructs an authentic, selectively enlarged 3D architectural model of Kyoto Station:
    - High-tech spatial matrix glass-and-steel atrium
    - Modern bullet train (Shinkansen) platform and high-speed train model
    - Stepped pedestrian grand staircase
    """
    parent = bpy.data.objects.new("POI_Kyoto_Station", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_station_glass = create_principled_material(
        "Mat_Station_Glass",
        **{
            "Base Color": (0.6, 0.85, 0.95, 1.0),
            "Roughness": 0.08,
            "Transmission Weight": 0.85,
            "IOR": 1.52,
        }
    )
    mat_steel_frame = create_principled_material("Mat_Station_Steel", **{"Base Color": (0.28, 0.30, 0.34, 1.0), "Metallic": 0.8, "Roughness": 0.3})
    mat_shinkansen = create_principled_material("Mat_Shinkansen_White", **{"Base Color": (0.95, 0.96, 0.98, 1.0), "Roughness": 0.15})
    mat_train_blue = create_principled_material("Mat_Shinkansen_Stripe_Blue", **{"Base Color": (0.05, 0.35, 0.82, 1.0), "Roughness": 0.2})
    mat_headlight = create_principled_material("Mat_Train_Headlight", **{"Base Color": (1.0, 1.0, 0.9, 1.0), "Emission Color": (1.0, 1.0, 0.9, 1.0), "Emission Strength": 6.0})
    
    # 1. Main Terminal Concourse Building
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    station = bpy.context.active_object
    station.name = "Station_Terminal_Building"
    station.scale = (1.4, 0.85, 0.65)
    station.location = (x, y, z + 0.33)
    bpy.ops.object.transform_apply(location=True, scale=True)
    station.data.materials.append(mat_steel_frame)
    station.parent = parent
    
    # Curved Glass Atrium Facade
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    atrium = bpy.context.active_object
    atrium.name = "Station_Glass_Atrium"
    atrium.scale = (1.2, 0.25, 0.55)
    atrium.location = (x, y + 0.35, z + 0.35)
    bpy.ops.object.transform_apply(location=True, scale=True)
    atrium.data.materials.append(mat_station_glass)
    atrium.parent = parent
    
    # Grand Staircase (Stepped cubes)
    for step in range(5):
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        st = bpy.context.active_object
        st.name = f"Station_Step_{step}"
        st.scale = (0.5, 0.1, 0.06 * (5 - step))
        st.location = (x - 0.2, y + 0.45 + step * 0.08, z + 0.03 * (5 - step))
        bpy.ops.object.transform_apply(location=True, scale=True)
        st.data.materials.append(mat_steel_frame)
        st.parent = parent
        
    # 2. Shinkansen Bullet Train on Platform
    train_x, train_y = x + 0.2, y - 0.55
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    train = bpy.context.active_object
    train.name = "Shinkansen_Bullet_Train"
    train.scale = (1.3, 0.16, 0.15)
    train.location = (train_x, train_y, z + 0.08)
    bpy.ops.object.transform_apply(location=True, scale=True)
    train.data.materials.append(mat_shinkansen)
    train.parent = parent
    
    # Shinkansen Blue Stripe
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    stripe = bpy.context.active_object
    stripe.name = "Shinkansen_Blue_Stripe"
    stripe.scale = (1.3, 0.162, 0.03)
    stripe.location = (train_x, train_y, z + 0.06)
    bpy.ops.object.transform_apply(location=True, scale=True)
    stripe.data.materials.append(mat_train_blue)
    stripe.parent = parent
    
    # Glowing Headlight Beams
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.02, location=(train_x + 0.65, train_y, z + 0.08))
    light = bpy.context.active_object
    light.name = "Shinkansen_Headlight"
    light.rotation_euler = Euler((0.0, math.radians(90.0), 0.0), 'XYZ')
    light.data.materials.append(mat_headlight)
    light.parent = parent
    
    return parent


# ==============================================================================
# 6. VOLUMETRIC FLOW & ROUTE HIGHLIGHTS
# ==============================================================================

def create_volumetric_route_ribbon_and_waypoints(waypoints):
    """
    Renders the sequential route as a semi-translucent, glowing neon/LED glass ribbon
    hovering slightly above the asphalt street tracks, complete with physical 3D waypoint pins.
    """
    if len(waypoints) < 2:
        return
        
    mat_ribbon = create_route_neon_ribbon_material()
    mat_pin_metal = create_principled_material("Mat_Pin_Chrome", **{"Base Color": (0.85, 0.88, 0.92, 1.0), "Metallic": 0.9, "Roughness": 0.1})
    mat_pin_orb = create_principled_material(
        "Mat_Pin_Glowing_Core",
        **{
            "Base Color": (0.0, 0.85, 1.0, 1.0),
            "Emission Color": (0.0, 0.85, 1.0, 1.0),
            "Emission Strength": 5.0,
            "Roughness": 0.1,
        }
    )
    mat_pin_text = create_principled_material("Mat_Pin_Text", **{"Base Color": (1.0, 1.0, 1.0, 1.0), "Emission Color": (1.0, 1.0, 1.0, 1.0), "Emission Strength": 4.0})
    
    # 1. Glowing 3D Route Ribbon (Hovering 0.18 above ground)
    curve_data = bpy.data.curves.new('Route_Ribbon_Curve', type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.resolution_u = 16
    curve_data.bevel_depth = 0.0
    
    polyline = curve_data.splines.new('BEZIER')
    polyline.bezier_points.add(len(waypoints) - 1)
    
    ribbon_height = 0.18
    for i, wp in enumerate(waypoints):
        pt = polyline.bezier_points[i]
        pt.co = Vector((wp['x'], wp['y'], wp.get('z', 0.0) + ribbon_height))
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
        
    curve_obj = bpy.data.objects.new('Route_Ribbon_Spline', curve_data)
    bpy.context.scene.collection.objects.link(curve_obj)
    
    # Convert to extruded ribbon mesh
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    # Extrude bevel flat ribbon
    curve_data.extrude = 0.07  # Ribbon width
    curve_obj.data.materials.append(mat_ribbon)
    
    # 2. Physical 3D Waypoint Pins & Stop Numbers
    for i, wp in enumerate(waypoints):
        wx, wy, wz = wp['x'], wp['y'], wp.get('z', 0.0)
        
        # Ground Anchor Ring (Metallic chrome base on road)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.03, location=(wx, wy, wz + 0.02))
        base_ring = bpy.context.active_object
        base_ring.name = f"Waypoint_Base_{i+1}"
        base_ring.data.materials.append(mat_pin_metal)
        
        # Vertical Standoff Pin
        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.5, location=(wx, wy, wz + 0.28))
        stem = bpy.context.active_object
        stem.name = f"Waypoint_Stem_{i+1}"
        stem.data.materials.append(mat_pin_metal)
        
        # Glowing Jewel Core Sphere
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(wx, wy, wz + 0.58))
        orb = bpy.context.active_object
        orb.name = f"Waypoint_Orb_{i+1}"
        orb.data.materials.append(mat_pin_orb)
        
        # Floating 3D Extruded Waypoint Number (e.g. 1, 2, 3...)
        bpy.ops.object.text_add(location=(wx - 0.05, wy - 0.05, wz + 0.8))
        txt = bpy.context.active_object
        txt.name = f"Waypoint_Number_{i+1}"
        txt.data.body = str(i + 1)
        txt.data.size = 0.22
        txt.data.extrude = 0.04
        # Align to isometric camera angle
        txt.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        txt.data.materials.append(mat_pin_text)


# ==============================================================================
# 7. DIMENSIONAL FLOATING HUD & UI PANELS
# ==============================================================================

def create_floating_hud_panels(params=None):
    """
    Renders dimensional floating HUD & UI panels:
    - Physical frosted-glass floating slabs with subtle refractions, cast shadows, and glowing edges
    - Anchored in 3D isometric space above the diorama scene
    """
    params = params or {}
    mat_glass = create_frosted_acrylic_hud_material()
    mat_hud_text = create_principled_material("Mat_HUD_Text_White", **{"Base Color": (1.0, 1.0, 1.0, 1.0), "Emission Color": (1.0, 1.0, 1.0, 1.0), "Emission Strength": 2.5})
    mat_hud_cyan = create_principled_material("Mat_HUD_Accent_Cyan", **{"Base Color": (0.0, 0.9, 1.0, 1.0), "Emission Color": (0.0, 0.9, 1.0, 1.0), "Emission Strength": 3.8})
    mat_hud_pill = create_principled_material("Mat_HUD_Pill_Badge", **{"Base Color": (0.1, 0.15, 0.22, 1.0), "Roughness": 0.4, "Emission Color": (0.0, 0.5, 0.7, 1.0), "Emission Strength": 0.8})
    
    region = (params.get("region_name") or "KYOTO, JAPAN").upper()
    day_num = params.get("day_number", 1)
    title = f"{region} · DAY {day_num}"
    metrics_str = params.get("key_metrics") or "5.4 KM · 11,200 STEPS · +142M ELEV"
    pills = params.get("filter_labels") or ["[ITINERARY]", "[CLEAR 18°C]", "[PACING: OPTIMAL]"]
    
    # 1. Master HUD Plaque (Floating high in the upper quadrant: X = -2.8, Y = 4.6, Z = 3.8)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hud_slab = bpy.context.active_object
    hud_slab.name = "HUD_Master_Plaque"
    hud_slab.scale = (3.4, 1.4, 0.08)
    hud_slab.location = (-2.8, 4.6, 3.8)
    hud_slab.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    bpy.ops.object.transform_apply(location=False, scale=True)
    hud_slab.data.materials.append(mat_glass)
    
    # Add Bevel for physical glass prism bevel reflections
    bpy.ops.object.modifier_add(type='BEVEL')
    hud_slab.modifiers["Bevel"].width = 0.03
    hud_slab.modifiers["Bevel"].segments = 2
    
    # 3D Embossed Title on Plaque
    bpy.ops.object.text_add(location=(-3.8, 4.4, 4.2))
    title_obj = bpy.context.active_object
    title_obj.name = "HUD_Title_Text"
    title_obj.data.body = title
    title_obj.data.size = 0.2
    title_obj.data.extrude = 0.02
    title_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    title_obj.data.materials.append(mat_hud_text)
    
    # Key Metrics Subheader
    bpy.ops.object.text_add(location=(-3.7, 4.25, 3.9))
    metrics_obj = bpy.context.active_object
    metrics_obj.name = "HUD_Metrics_Text"
    metrics_obj.data.body = metrics_str
    metrics_obj.data.size = 0.13
    metrics_obj.data.extrude = 0.015
    metrics_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    metrics_obj.data.materials.append(mat_hud_cyan)
    
    # Status Pill Badges
    for idx, pill_text in enumerate(pills):
        bpy.ops.object.text_add(location=(-3.6 + idx * 0.95, 4.1 - idx * 0.15, 3.6))
        pill_obj = bpy.context.active_object
        pill_obj.name = f"HUD_Pill_{idx+1}"
        pill_obj.data.body = str(pill_text)
        pill_obj.data.size = 0.09
        pill_obj.data.extrude = 0.01
        pill_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        pill_obj.data.materials.append(mat_hud_text)
        
    # 2. Dimensional Landmark Floating Callouts
    custom_callouts = params.get("callouts") if params else None
    callouts = custom_callouts or [
        {"x": 3.8, "y": 2.8, "z": 0.7, "title": "Kiyomizu-dera", "tag": "09:00 AM · Cash Only"},
        {"x": 2.5, "y": -3.2, "z": 0.0, "title": "Fushimi Inari", "tag": "14:00 PM · Free Entry"},
        {"x": -2.8, "y": 3.2, "z": 0.0, "title": "Kinkaku-ji", "tag": "11:30 AM · Ticket Req"},
    ]
    
    for c in callouts:
        cx, cy, cz = c["x"], c["y"], c["z"]
        # Vertical Tether Rod
        bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=1.4, location=(cx, cy, cz + 1.2))
        tether = bpy.context.active_object
        tether.name = f"Callout_Tether_{c['title']}"
        tether.data.materials.append(mat_hud_cyan)
        
        # Frosted Acrylic Floating Pill
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        card = bpy.context.active_object
        card.name = f"Callout_Card_{c['title']}"
        card.scale = (1.5, 0.45, 0.05)
        card.location = (cx, cy, cz + 2.0)
        card.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        bpy.ops.object.transform_apply(location=False, scale=True)
        card.data.materials.append(mat_glass)
        
        # Landmark Label
        bpy.ops.object.text_add(location=(cx - 0.45, cy + 0.1, cz + 2.05))
        lbl = bpy.context.active_object
        lbl.name = f"Callout_Label_{c['title']}"
        lbl.data.body = c['title']
        lbl.data.size = 0.12
        lbl.data.extrude = 0.015
        lbl.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        lbl.data.materials.append(mat_hud_text)
        
        # Sub-badge Tag
        bpy.ops.object.text_add(location=(cx - 0.42, cy + 0.02, cz + 1.9))
        sub = bpy.context.active_object
        sub.name = f"Callout_Sub_{c['title']}"
        sub.data.body = c['tag']
        sub.data.size = 0.08
        sub.data.extrude = 0.01
        sub.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        sub.data.materials.append(mat_hud_cyan)


# ==============================================================================
# 8. MASTER ORCHESTRATION PIPELINE
# ==============================================================================

def generate_diorama(input_params=None, output_filepath=None, samples=64, resolution=(1920, 1080)):
    """
    Executes the complete end-to-end 3D isometric diorama generation pipeline.
    """
    print("=" * 70)
    print("3D ENVIRONMENTAL DESIGN & CARTOGRAPHIC VISUALIZATION ENGINE")
    print("=" * 70)
    print(f"[Engine] Target Resolution: {resolution[0]}x{resolution[1]} | Samples: {samples}")
    
    # 1. Setup Scene & Isometric Camera
    setup_diorama_scene(resolution=resolution, samples=samples, use_metal=True)
    
    # 2. Build Floating Chunk Base & Cross-Section
    print("[Engine] Generating self-contained floating rock/soil chunk with geological strata...")
    create_floating_chunk_base(width=10.0, length=10.0, base_depth=2.4)
    
    # 3. Carve River & Water Cross-Section
    print("[Engine] Carving river channel with glossy resin water cross-section...")
    create_river_water_cross_section(width=10.0, river_width=1.4, river_depth=0.35)
    
    # 4. Lay Miniature Infrastructure & Urban Blocks
    print("[Engine] Constructing miniature road corridors, machiya townhouses, and foliage...")
    create_road_corridors_and_blocks()
    
    # 5. Build Selectively Enlarged 3D Architectural POIs
    print("[Engine] Sculpting selectively enlarged landmark models (Kiyomizu-dera, Fushimi Inari, Kinkaku-ji, Kyoto Station)...")
    build_shinto_torii_and_shrine(x=2.5, y=-3.2, z=0.0)
    build_kiyomizu_dera_complex(x=3.8, y=2.8, z=0.7)
    build_kinkaku_ji_golden_pavilion(x=-2.8, y=3.2, z=0.0)
    build_kyoto_station_modern_hub(x=-1.5, y=-2.8, z=0.0)
    
    # 6. Build Volumetric Glowing Route Ribbon & Waypoints
    print("[Engine] Tracing volumetric neon glass route ribbon and physical 3D waypoint pins...")
    waypoints = (input_params.get("waypoints") if input_params else None) or [
        {"x": -1.5, "y": -2.8, "z": 0.0, "name": "Kyoto Station"},
        {"x": 2.5, "y": -3.2, "z": 0.0, "name": "Fushimi Inari Taisha"},
        {"x": 1.5, "y": 0.5, "z": 0.0, "name": "Gion Shijo Junction"},
        {"x": 3.8, "y": 2.8, "z": 0.7, "name": "Kiyomizu-dera"},
        {"x": -0.8, "y": 2.0, "z": 0.0, "name": "Nishiki Market Area"},
        {"x": -2.8, "y": 3.2, "z": 0.0, "name": "Kinkaku-ji"},
    ]
    create_volumetric_route_ribbon_and_waypoints(waypoints)
    
    # 7. Build Dimensional Floating Glassmorphic HUD & Callout Panels
    print("[Engine] Projecting physical frosted-glass HUD and dimensional landmark callouts...")
    create_floating_hud_panels(input_params)
    
    # 8. Render Scene via Cycles Metal
    out_path = output_filepath or os.path.abspath("public/dioramas/kyoto_day1_isometric_chunk.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    bpy.context.scene.render.filepath = out_path
    print(f"[Engine] Commencing Cycles Metal physical render -> {out_path} ...")
    
    bpy.ops.render.render(write_still=True)
    print(f"[Engine] Render successfully written to: {out_path}")
    print("=" * 70)
    return out_path


# ==============================================================================
# 9. CLI ENTRY POINT (Blender headless execution)
# ==============================================================================

def main():
    # Parse CLI flags after '--'
    args_list = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="TripPlanner 3D Isometric Diorama Engine")
    parser.add_argument("--input", type=str, help="Path to input JSON parameter payload")
    parser.add_argument("--output", type=str, help="Output PNG path", default="public/dioramas/kyoto_day1_isometric_chunk.png")
    parser.add_argument("--samples", type=int, help="Cycles render samples (default: 64)", default=64)
    parser.add_argument("--width", type=int, help="Render width", default=1920)
    parser.add_argument("--height", type=int, help="Render height", default=1080)
    
    parsed = parser.parse_args(args_list)
    
    input_data = None
    if parsed.input and os.path.exists(parsed.input):
        with open(parsed.input, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
            
    generate_diorama(
        input_params=input_data,
        output_filepath=parsed.output,
        samples=parsed.samples,
        resolution=(parsed.width, parsed.height)
    )

if __name__ == "__main__":
    main()
