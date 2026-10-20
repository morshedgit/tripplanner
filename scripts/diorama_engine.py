#!/usr/bin/env python3
"""
3D Environmental Design & Cartographic Visualization Engine
Universal 2.5D Isometric Diorama Generator

Transforms ANY geographic, spatial, and point-of-interest (POI) parameters into an authentic,
tactile 3D isometric diorama scene for ANY destination, city, country, or itinerary in the world
using Headless Blender 5.x and Cycles Metal GPU rendering.
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
# 1. BIOME & ARCHITECTURAL ARCHETYPE CLASSIFIER (UNIVERSAL GLOBAL SUPPORT)
# ==============================================================================

def classify_destination_archetype(region_name):
    """
    Classifies ANY city, country, or destination into an architectural and biome archetype:
    - 'east_asian': Kyoto, Tokyo, Osaka, Japan, Seoul, Korea, Beijing, China, Taipei, etc.
    - 'mediterranean': Rome, Florence, Venice, Milan, Italy, Athens, Greece, Barcelona, Madrid, Spain, Lisbon, Portugal, etc.
    - 'european_classical': Paris, France, London, UK, Vienna, Austria, Amsterdam, Prague, Berlin, Germany, Dublin, etc.
    - 'modern_metropolis': New York, Chicago, San Francisco, USA, Toronto, Singapore, Dubai, Hong Kong, Sydney, etc.
    - 'tropical_coastal': Hawaii, Honolulu, Bali, Phuket, Thailand, Cancun, Caribbean, Bahamas, Maldives, etc.
    - 'alpine_nordic': Reykjavik, Iceland, Switzerland, Zermatt, Oslo, Norway, Stockholm, Finland, Aspen, Banff, etc.
    """
    if not region_name:
        return 'east_asian'
    r = region_name.lower()
    
    if any(k in r for k in ['kyoto', 'tokyo', 'osaka', 'japan', 'seoul', 'korea', 'beijing', 'shanghai', 'china', 'taipei', 'taiwan', 'hokkaido', 'nara', 'hiroshima', 'asia']):
        return 'east_asian'
    if any(k in r for k in ['rome', 'roma', 'florence', 'firenze', 'venice', 'venezia', 'milan', 'italy', 'italia', 'athens', 'greece', 'barcelona', 'madrid', 'spain', 'espana', 'lisbon', 'portugal', 'naples', 'sicily', 'amalfi', 'mediterranean']):
        return 'mediterranean'
    if any(k in r for k in ['paris', 'france', 'london', 'england', 'uk', 'britain', 'edinburgh', 'scotland', 'vienna', 'austria', 'amsterdam', 'netherlands', 'prague', 'czech', 'berlin', 'munich', 'germany', 'brussels', 'belgium', 'dublin', 'ireland', 'europe']):
        return 'european_classical'
    if any(k in r for k in ['new york', 'nyc', 'manhattan', 'chicago', 'san francisco', 'seattle', 'los angeles', 'miami', 'las vegas', 'usa', 'america', 'toronto', 'canada', 'singapore', 'dubai', 'hong kong', 'sydney', 'melbourne']):
        return 'modern_metropolis'
    if any(k in r for k in ['hawaii', 'honolulu', 'maui', 'oahu', 'bali', 'indonesia', 'phuket', 'bangkok', 'thailand', 'cancun', 'mexico', 'caribbean', 'bahamas', 'fiji', 'maldives', 'costa rica', 'tahiti', 'tropical']):
        return 'tropical_coastal'
    if any(k in r for k in ['iceland', 'reykjavik', 'switzerland', 'swiss', 'alps', 'zermatt', 'interlaken', 'zurich', 'norway', 'oslo', 'sweden', 'stockholm', 'finland', 'helsinki', 'denmark', 'copenhagen', 'aspen', 'banff', 'nordic']):
        return 'alpine_nordic'
        
    return 'mediterranean'


# ==============================================================================
# 2. SHADER & MATERIAL FACTORY (Tactile, Physical Aesthetics)
# ==============================================================================

def create_principled_material(name, **kwargs):
    """Creates a high-fidelity Principled BSDF material in Blender 5.x."""
    mat = bpy.data.materials.new(name=name)
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    if not bsdf:
        return mat
        
    for k, v in kwargs.items():
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
            
    return mat


def create_geological_strata_material(archetype='east_asian'):
    """
    Creates an authentic layered cross-section procedural shader adapted to regional geology:
    - Mediterranean: Warm travertine limestone, terracotta strata, golden honey bedrock
    - East Asian: Volcanic loam topsoil, sandstone banding, basalt foundation
    - European Classical: Rich humus topsoil, chalk/limestone strata, flint bedrock
    - Modern Metropolis: Urban gravel/soil, concrete strata, Manhattan schist bedrock
    - Tropical Coastal: White coral sand, calcified reef limestone, dark volcanic tuff
    - Alpine Nordic: Glacial moraine silt, banded slate/gneiss, granite bedrock
    """
    mat = bpy.data.materials.new(name=f"Mat_Geological_Strata_{archetype}")
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    tex_coord = nodes.new(type="ShaderNodeTexCoord")
    mapping = nodes.new(type="ShaderNodeMapping")
    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
    
    sep_xyz = nodes.new(type="ShaderNodeSeparateXYZ")
    links.new(mapping.outputs["Vector"], sep_xyz.inputs["Vector"])
    
    noise = nodes.new(type="ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14.0
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.6
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    
    math_perturb = nodes.new(type="ShaderNodeMath")
    math_perturb.operation = 'MULTIPLY_ADD'
    math_perturb.inputs[1].default_value = 0.12
    links.new(noise.outputs["Fac"], math_perturb.inputs[0])
    links.new(sep_xyz.outputs["Z"], math_perturb.inputs[2])
    
    ramp = nodes.new(type="ShaderNodeValToRGB")
    elements = ramp.color_ramp.elements
    
    # Archetype color calibrations
    if archetype == 'mediterranean':
        # Travertine & Terracotta Warm Earth
        elements[0].position = 0.0
        elements[0].color = (0.24, 0.20, 0.16, 1.0) # Bedrock
        el1 = elements.new(0.35); el1.color = (0.48, 0.38, 0.28, 1.0) # Travertine
        el2 = elements.new(0.62); el2.color = (0.62, 0.44, 0.30, 1.0) # Terracotta clay
        elements[1].position = 1.0
        elements[1].color = (0.35, 0.25, 0.18, 1.0) # Mediterranean topsoil
    elif archetype == 'modern_metropolis':
        # Concrete & Manhattan Schist
        elements[0].position = 0.0
        elements[0].color = (0.12, 0.13, 0.15, 1.0) # Schist bedrock
        el1 = elements.new(0.35); el1.color = (0.28, 0.30, 0.32, 1.0)
        el2 = elements.new(0.65); el2.color = (0.45, 0.46, 0.48, 1.0) # Concrete foundation
        elements[1].position = 1.0
        elements[1].color = (0.20, 0.20, 0.20, 1.0) # Sub-grade soil
    elif archetype == 'tropical_coastal':
        # Coral Limestone & Volcanic Sand
        elements[0].position = 0.0
        elements[0].color = (0.15, 0.14, 0.13, 1.0) # Basalt
        el1 = elements.new(0.40); el1.color = (0.65, 0.62, 0.52, 1.0) # Coral limestone
        el2 = elements.new(0.70); el2.color = (0.82, 0.78, 0.65, 1.0) # White sand strata
        elements[1].position = 1.0
        elements[1].color = (0.90, 0.86, 0.72, 1.0) # Golden beach sand
    elif archetype == 'alpine_nordic':
        # Glacial Moraine & Grey Granite
        elements[0].position = 0.0
        elements[0].color = (0.18, 0.20, 0.22, 1.0) # Granite
        el1 = elements.new(0.38); el1.color = (0.35, 0.38, 0.42, 1.0) # Slate
        el2 = elements.new(0.68); el2.color = (0.55, 0.58, 0.62, 1.0) # Moraine silt
        elements[1].position = 1.0
        elements[1].color = (0.28, 0.30, 0.30, 1.0) # Alpine tundra
    else:
        # East Asian / Standard Loam
        elements[0].position = 0.0
        elements[0].color = (0.12, 0.12, 0.15, 1.0)
        el1 = elements.new(0.35); el1.color = (0.28, 0.22, 0.17, 1.0)
        el2 = elements.new(0.60); el2.color = (0.52, 0.43, 0.32, 1.0)
        el3 = elements.new(0.78); el3.color = (0.38, 0.30, 0.22, 1.0)
        elements[1].position = 1.0
        elements[1].color = (0.18, 0.13, 0.08, 1.0)
    
    map_range = nodes.new(type="ShaderNodeMapRange")
    map_range.inputs["From Min"].default_value = -3.0
    map_range.inputs["From Max"].default_value = 0.0
    map_range.inputs["To Min"].default_value = 0.0
    map_range.inputs["To Max"].default_value = 1.0
    links.new(math_perturb.outputs["Value"], map_range.inputs["Value"])
    links.new(map_range.outputs["Result"], ramp.inputs["Fac"])
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.85
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    
    bump = nodes.new(type="ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.1
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def create_resin_water_material(archetype='east_asian'):
    """Glossy transparent jewel-resin water material adapted to destination aquatic hue."""
    mat = bpy.data.materials.new(name=f"Mat_Resin_Water_{archetype}")
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    
    # Archetype water color
    if archetype == 'tropical_coastal':
        water_color = (0.02, 0.65, 0.75, 1.0) # Sparkling Caribbean/Pacific turquoise
    elif archetype == 'mediterranean':
        water_color = (0.08, 0.42, 0.55, 1.0) # Deep Mediterranean sapphire/azure
    elif archetype == 'alpine_nordic':
        water_color = (0.15, 0.55, 0.65, 1.0) # Glacial meltwater cyan
    else:
        water_color = (0.05, 0.35, 0.45, 1.0) # Classic river emerald-teal
        
    bsdf.inputs["Base Color"].default_value = water_color
    bsdf.inputs["Roughness"].default_value = 0.03
    bsdf.inputs["IOR"].default_value = 1.333
    bsdf.inputs["Transmission Weight"].default_value = 0.95
    bsdf.inputs["Coat Weight"].default_value = 0.4
    bsdf.inputs["Coat Roughness"].default_value = 0.02
    
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
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.88, 0.94, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["IOR"].default_value = 1.48
    bsdf.inputs["Transmission Weight"].default_value = 0.88
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.05
    bsdf.inputs["Emission Color"].default_value = (0.0, 0.7, 0.9, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.15
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def create_route_neon_ribbon_material():
    """Volumetric glowing neon/LED glass ribbon material for route path."""
    mat = bpy.data.materials.new(name="Mat_Route_Neon_Ribbon")
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.9, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.15
    bsdf.inputs["Transmission Weight"].default_value = 0.75
    bsdf.inputs["Emission Color"].default_value = (0.05, 0.85, 1.0, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 4.5
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


# ==============================================================================
# 3. SCENE INITIALIZATION & CAMERA SETUP
# ==============================================================================

def setup_diorama_scene(resolution=(1920, 1080), samples=64, use_metal=True):
    """Initializes a pristine Blender scene calibrated for physical isometric rendering."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    for coll in [bpy.data.materials, bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.curves]:
        for block in list(coll):
            coll.remove(block)
            
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    
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
            scene.cycles.device = 'GPU' if has_gpu else 'CPU'
        except Exception as e:
            print(f"[Engine] Warning: Metal initialization fallback to CPU ({e})")
            scene.cycles.device = 'CPU'
    else:
        scene.cycles.device = 'CPU'
        
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.film_transparent = True
    
    # 45-degree elevated Isometric Camera
    cam_data = bpy.data.cameras.new("Diorama_Isometric_Camera")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 19.5
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = 22.0
    cam_data.dof.aperture_fstop = 8.0
    
    cam_obj = bpy.data.objects.new("Diorama_Isometric_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    cam_obj.location = Vector((14.0, -14.0, 12.5))
    cam_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    
    # 1. Warm Directional Sunlight
    sun_data = bpy.data.lights.new(name="Sun_KeyLight", type='SUN')
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.96, 0.90)
    sun_data.angle = math.radians(6.5)
    sun_obj = bpy.data.objects.new("Sun_KeyLight", sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.location = Vector((6.0, -8.0, 14.0))
    sun_obj.rotation_euler = Euler((math.radians(48.0), math.radians(22.0), math.radians(35.0)), 'XYZ')
    
    # 2. Cool Sky Fill Light
    sky_data = bpy.data.lights.new(name="Sky_FillLight", type='SUN')
    sky_data.energy = 1.6
    sky_data.color = (0.82, 0.90, 1.0)
    sky_data.angle = math.radians(15.0)
    sky_obj = bpy.data.objects.new("Sky_FillLight", sky_data)
    scene.collection.objects.link(sky_obj)
    sky_obj.location = Vector((-8.0, 8.0, 12.0))
    sky_obj.rotation_euler = Euler((math.radians(120.0), 0.0, math.radians(-45.0)), 'XYZ')
    
    # 3. Soft Under-Rim Light
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
# 4. CHUNK BASE & TOPOGRAPHY (ADAPTIVE BIOMES)
# ==============================================================================

def create_floating_chunk_base(archetype='east_asian', width=10.0, length=10.0, base_depth=2.4):
    """Constructs the floating chunk base with strata tailored to the destination archetype."""
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    base_obj = bpy.context.active_object
    base_obj.name = "Chunk_Subterranean_Base"
    base_obj.scale = (width, length, base_depth)
    base_obj.location = (0.0, 0.0, -base_depth / 2.0)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    strata_mat = create_geological_strata_material(archetype)
    base_obj.data.materials.append(strata_mat)
    
    bpy.ops.object.modifier_add(type='BEVEL')
    bev = base_obj.modifiers["Bevel"]
    bev.width = 0.08
    bev.segments = 3
    
    # Top Terrain Ground Surface
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    ground_obj = bpy.context.active_object
    ground_obj.name = "Terrain_Surface_Ground"
    ground_obj.scale = (width - 0.04, length - 0.04, 1.0)
    ground_obj.location = (0.0, 0.0, 0.005)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    # Archetype ground color
    if archetype == 'mediterranean':
        ground_color = (0.38, 0.42, 0.25, 1.0) # Sun-warmed Mediterranean olive-gold turf
    elif archetype == 'modern_metropolis':
        ground_color = (0.25, 0.38, 0.22, 1.0) # Manicured urban park turf
    elif archetype == 'tropical_coastal':
        ground_color = (0.28, 0.52, 0.22, 1.0) # Lush vibrant tropical green
    elif archetype == 'alpine_nordic':
        ground_color = (0.32, 0.35, 0.30, 1.0) # Alpine lichen/tundra green
    else:
        ground_color = (0.22, 0.38, 0.20, 1.0) # Rich East Asian moss green
        
    mat_ground = create_principled_material(
        f"Mat_Terrain_Surface_{archetype}",
        **{
            "Base Color": ground_color,
            "Roughness": 0.75,
            "Subsurface Weight": 0.25,
            "Subsurface Radius": (0.4, 0.7, 0.2),
        }
    )
    ground_obj.data.materials.append(mat_ground)
    
    # Perimeter Contours & Elevation Relief
    hill_coords = [
        (4.2, 3.8, 0.8, 1.6),
        (3.5, 4.2, 0.6, 1.8),
        (4.5, 1.8, 0.9, 1.4),
        (4.0, -1.2, 0.7, 1.5),
        (-4.0, 3.8, 0.5, 1.4),
    ]
    for i, (hx, hy, hz, r) in enumerate(hill_coords):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=hz, location=(hx, hy, hz/2.0))
        hill = bpy.context.active_object
        hill.name = f"Terrain_Contour_Hill_{i+1}"
        hill.data.materials.append(mat_ground)
        bpy.ops.object.modifier_add(type='BEVEL')
        hill.modifiers["Bevel"].width = 0.15
        hill.modifiers["Bevel"].segments = 2
        
    return base_obj


def create_river_water_cross_section(archetype='east_asian', width=10.0, river_width=1.4, river_depth=0.35):
    """Carves a river channel with resin water cross-section adapted to region."""
    mat_water = create_resin_water_material(archetype)
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    water_obj = bpy.context.active_object
    water_obj.name = "River_Resin_Channel"
    water_obj.scale = (river_width, width, river_depth)
    water_obj.location = (-0.8, 0.0, -river_depth / 2.0)
    bpy.ops.object.transform_apply(location=True, scale=True)
    water_obj.data.materials.append(mat_water)
    
    # Stepping stones / bridge pylons
    mat_stone = create_principled_material("Mat_Stepping_Stone", **{"Base Color": (0.42, 0.43, 0.44, 1.0), "Roughness": 0.7})
    for sy in [-2.5, 0.2, 2.8]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18, depth=0.1, location=(-0.8, sy, 0.03))
        stone = bpy.context.active_object
        stone.name = f"River_Stepping_Stone_{sy}"
        stone.data.materials.append(mat_stone)
        
    # Bridge across river adapted to archetype
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bridge = bpy.context.active_object
    bridge.name = "Bridge_River_Crossing"
    bridge.scale = (river_width + 0.6, 0.45, 0.08)
    bridge.location = (-0.8, 0.5, 0.06)
    bpy.ops.object.transform_apply(location=True, scale=True)
    
    if archetype == 'mediterranean':
        bridge_color = (0.78, 0.72, 0.62, 1.0) # Roman Travertine Stone Bridge
    elif archetype == 'modern_metropolis':
        bridge_color = (0.28, 0.32, 0.36, 1.0) # Steel Girder Bridge
    elif archetype == 'tropical_coastal':
        bridge_color = (0.48, 0.35, 0.22, 1.0) # Teak Boardwalk Pier
    else:
        bridge_color = (0.75, 0.22, 0.14, 1.0) # Vermilion Arched Bridge
        
    mat_bridge = create_principled_material("Mat_Bridge_Surface", **{"Base Color": bridge_color, "Roughness": 0.5})
    bridge.data.materials.append(mat_bridge)
    
    for side in [-0.2, 0.2]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        rail = bpy.context.active_object
        rail.name = f"Bridge_Rail_{side}"
        rail.scale = (river_width + 0.6, 0.04, 0.12)
        rail.location = (-0.8, 0.5 + side, 0.14)
        bpy.ops.object.transform_apply(location=True, scale=True)
        rail.data.materials.append(mat_bridge)


# ==============================================================================
# 5. ROADS & MINIATURE ARCHITECTURAL CITY BLOCKS (ADAPTIVE URBAN FABRIC)
# ==============================================================================

def create_road_corridors_and_blocks(archetype='east_asian'):
    """Renders road corridors and procedural city blocks calibrated to destination archetype."""
    mat_asphalt = create_principled_material("Mat_Road_Asphalt", **{"Base Color": (0.16, 0.17, 0.19, 1.0), "Roughness": 0.75})
    
    # Archetype Building Materials
    if archetype == 'mediterranean':
        # Warm Ochre / Terracotta Stucco & Tile
        mat_wall = create_principled_material("Mat_Urban_Wall", **{"Base Color": (0.82, 0.68, 0.52, 1.0), "Roughness": 0.7})
        mat_roof = create_principled_material("Mat_Urban_Roof", **{"Base Color": (0.74, 0.38, 0.22, 1.0), "Roughness": 0.6}) # Terracotta
    elif archetype == 'european_classical':
        # Haussmannian Cream Limestone & Zinc/Slate Mansard
        mat_wall = create_principled_material("Mat_Urban_Wall", **{"Base Color": (0.85, 0.82, 0.76, 1.0), "Roughness": 0.6})
        mat_roof = create_principled_material("Mat_Urban_Roof", **{"Base Color": (0.28, 0.32, 0.36, 1.0), "Roughness": 0.4}) # Zinc
    elif archetype == 'modern_metropolis':
        # Concrete & Reflective Glass Skyscraper Blocks
        mat_wall = create_principled_material("Mat_Urban_Wall", **{"Base Color": (0.42, 0.45, 0.50, 1.0), "Metallic": 0.4, "Roughness": 0.3})
        mat_roof = create_principled_material("Mat_Urban_Roof", **{"Base Color": (0.18, 0.20, 0.22, 1.0), "Roughness": 0.5})
    elif archetype == 'tropical_coastal':
        mat_wall = create_principled_material("Mat_Urban_Wall", **{"Base Color": (0.92, 0.88, 0.80, 1.0), "Roughness": 0.7})
        mat_roof = create_principled_material("Mat_Urban_Roof", **{"Base Color": (0.45, 0.36, 0.26, 1.0), "Roughness": 0.85}) # Thatch
    else:
        # East Asian / Machiya
        mat_wall = create_principled_material("Mat_Urban_Wall", **{"Base Color": (0.28, 0.19, 0.12, 1.0), "Roughness": 0.8})
        mat_roof = create_principled_material("Mat_Urban_Roof", **{"Base Color": (0.18, 0.20, 0.24, 1.0), "Roughness": 0.45})
        
    # Main Road Arteries
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ew = bpy.context.active_object
    road_ew.name = "Road_Boulevard_EW"
    road_ew.scale = (9.2, 0.55, 0.02)
    road_ew.location = (0.0, 0.5, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ew.data.materials.append(mat_asphalt)
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ns1 = bpy.context.active_object
    road_ns1.name = "Road_Avenue_NS_East"
    road_ns1.scale = (0.45, 9.2, 0.02)
    road_ns1.location = (1.5, 0.0, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ns1.data.materials.append(mat_asphalt)
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    road_ns2 = bpy.context.active_object
    road_ns2.name = "Road_Avenue_NS_West"
    road_ns2.scale = (0.45, 9.2, 0.02)
    road_ns2.location = (-3.0, 0.0, 0.012)
    bpy.ops.object.transform_apply(location=True, scale=True)
    road_ns2.data.materials.append(mat_asphalt)
    
    # Miniature Buildings
    building_clusters = [
        (-2.2, -1.2, 0.4, 0.5, 0.45),
        (-2.2, -2.0, 0.35, 0.6, 0.5),
        (-2.2, 1.4, 0.45, 0.5, 0.6),
        (-2.2, 2.3, 0.4, 0.7, 0.4),
        (-3.8, -1.0, 0.5, 0.5, 0.65),
        (-3.8, 1.2, 0.4, 0.6, 0.5),
        (0.6, -1.4, 0.35, 0.5, 0.45),
        (0.6, -2.2, 0.4, 0.45, 0.4),
        (0.6, 1.5, 0.35, 0.6, 0.5),
        (2.4, -0.6, 0.45, 0.55, 0.45),
        (2.4, 1.4, 0.5, 0.6, 0.55),
        (2.4, 2.4, 0.4, 0.5, 0.4),
    ]
    
    for i, (bx, by, bw, bl, bh) in enumerate(building_clusters):
        # In modern metropolis, scale heights upwards
        actual_h = bh * 1.8 if archetype == 'modern_metropolis' else bh
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        bld = bpy.context.active_object
        bld.name = f"CityBlock_Bld_{i+1}"
        bld.scale = (bw, bl, actual_h)
        bld.location = (bx, by, actual_h / 2.0 + 0.01)
        bpy.ops.object.transform_apply(location=True, scale=True)
        bld.data.materials.append(mat_wall)
        
        # Roof pitch (flat for metropolis, pitched for others)
        if archetype != 'modern_metropolis':
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=max(bw, bl) * 0.75, depth=0.15, location=(bx, by, actual_h + 0.08))
            roof = bpy.context.active_object
            roof.name = f"CityBlock_Roof_{i+1}"
            roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
            roof.data.materials.append(mat_roof)
            
    # Regional Foliage & Trees
    if archetype == 'mediterranean':
        foliage_1_color = (0.16, 0.28, 0.14, 1.0) # Slender dark Italian cypress
        foliage_2_color = (0.42, 0.48, 0.32, 1.0) # Silvery olive tree
    elif archetype == 'tropical_coastal':
        foliage_1_color = (0.12, 0.55, 0.20, 1.0) # Palm green
        foliage_2_color = (0.22, 0.65, 0.28, 1.0) # Tropical broadleaf
    elif archetype == 'alpine_nordic':
        foliage_1_color = (0.10, 0.22, 0.14, 1.0) # Deep alpine spruce
        foliage_2_color = (0.18, 0.28, 0.20, 1.0) # Conifer green
    else:
        foliage_1_color = (0.85, 0.18, 0.12, 1.0) # Momiji red
        foliage_2_color = (0.12, 0.28, 0.16, 1.0) # Pine green
        
    mat_f1 = create_principled_material("Mat_Foliage_Primary", **{"Base Color": foliage_1_color, "Roughness": 0.6, "Subsurface Weight": 0.3})
    mat_f2 = create_principled_material("Mat_Foliage_Secondary", **{"Base Color": foliage_2_color, "Roughness": 0.6, "Subsurface Weight": 0.3})
    mat_trunk = create_principled_material("Mat_Tree_Trunk", **{"Base Color": (0.28, 0.20, 0.14, 1.0), "Roughness": 0.85})
    
    tree_spots = [
        (-0.1, -3.2, 0.35, 1), (-0.1, -1.8, 0.4, 2), (-0.1, 1.8, 0.38, 1), (-0.1, 3.4, 0.42, 1),
        (-1.5, -3.5, 0.35, 2), (-1.5, 2.5, 0.38, 1), (3.8, 3.2, 0.55, 1), (4.4, 2.4, 0.48, 1),
        (4.2, 0.8, 0.5, 2), (3.6, -2.8, 0.5, 2), (4.2, -3.4, 0.45, 1),
    ]
    
    for i, (tx, ty, tr, f_type) in enumerate(tree_spots):
        # Cypress cone shape if mediterranean, otherwise icosphere canopy
        if archetype == 'mediterranean' and f_type == 1:
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=tr * 0.55, depth=tr * 2.2, location=(tx, ty, tr * 1.1 + 0.1))
            canopy = bpy.context.active_object
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=tr, location=(tx, ty, tr + 0.15))
            canopy = bpy.context.active_object
            
        canopy.name = f"Foliage_Canopy_{i+1}"
        canopy.data.materials.append(mat_f1 if f_type == 1 else mat_f2)
        
        bpy.ops.mesh.primitive_cylinder_add(radius=tr * 0.18, depth=0.3, location=(tx, ty, 0.15))
        trunk = bpy.context.active_object
        trunk.name = f"Foliage_Trunk_{i+1}"
        trunk.data.materials.append(mat_trunk)


# ==============================================================================
# 6. UNIVERSAL PROCEDURAL ARCHITECTURAL POI SCULPTORS
# ==============================================================================

# A. Mediterranean & Classical Heritage (Rome, Florence, Athens, Europe)
def build_colosseum_amphitheater(x=2.0, y=-2.0, z=0.0):
    """Sculpts an authentic Roman Colosseum / Ancient Amphitheater."""
    parent = bpy.data.objects.new("POI_Colosseum_Amphitheater", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_travertine = create_principled_material("Mat_Travertine_Marble", **{"Base Color": (0.86, 0.78, 0.68, 1.0), "Roughness": 0.65})
    mat_inner_arena = create_principled_material("Mat_Arena_Sand", **{"Base Color": (0.75, 0.62, 0.45, 1.0), "Roughness": 0.9})
    
    # Outer Tiered Ellipse
    for tier in range(3):
        tz = z + tier * 0.32
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.0 - tier * 0.05, depth=0.3, location=(x, y, tz + 0.15))
        t = bpy.context.active_object
        t.name = f"Colosseum_Tier_{tier+1}"
        t.scale = (1.2, 0.9, 1.0)
        bpy.ops.object.transform_apply(location=False, scale=True)
        t.data.materials.append(mat_travertine)
        t.parent = parent
        
    # Hollow Center Arena
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.6, depth=1.05, location=(x, y, z + 0.55))
    inner = bpy.context.active_object
    inner.name = "Colosseum_Inner_Arena"
    inner.scale = (1.2, 0.9, 1.0)
    bpy.ops.object.transform_apply(location=False, scale=True)
    inner.data.materials.append(mat_inner_arena)
    inner.parent = parent
    return parent


def build_classical_basilica_dome(x=-2.0, y=2.0, z=0.0):
    """Sculpts a classical cathedral / Renaissance basilica with ribbed dome and portico."""
    parent = bpy.data.objects.new("POI_Classical_Basilica", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_marble = create_principled_material("Mat_Basilica_Marble", **{"Base Color": (0.88, 0.85, 0.80, 1.0), "Roughness": 0.5})
    mat_dome_copper = create_principled_material("Mat_Basilica_Dome_Copper", **{"Base Color": (0.28, 0.55, 0.48, 1.0), "Roughness": 0.35}) # Verdigris copper
    mat_gold = create_principled_material("Mat_Basilica_Gold_Cross", **{"Base Color": (0.95, 0.80, 0.25, 1.0), "Metallic": 0.9, "Roughness": 0.15})
    
    # Main nave hall
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    nave = bpy.context.active_object
    nave.name = "Basilica_Nave"
    nave.scale = (1.1, 0.85, 0.55)
    nave.location = (x, y, z + 0.28)
    bpy.ops.object.transform_apply(location=True, scale=True)
    nave.data.materials.append(mat_marble)
    nave.parent = parent
    
    # Front Temple Portico Columns
    for cx in [-0.4, -0.2, 0.0, 0.2, 0.4]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.55, location=(x + cx, y + 0.48, z + 0.28))
        col = bpy.context.active_object
        col.data.materials.append(mat_marble)
        col.parent = parent
        
    # Triangular Pediment
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.55, depth=0.1, location=(x, y + 0.48, z + 0.65))
    ped = bpy.context.active_object
    ped.rotation_euler = Euler((math.radians(90.0), 0.0, 0.0), 'XYZ')
    ped.data.materials.append(mat_marble)
    ped.parent = parent
    
    # Renaissance Drum & Ribbed Dome
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.45, depth=0.25, location=(x, y - 0.1, z + 0.65))
    drum = bpy.context.active_object
    drum.data.materials.append(mat_marble)
    drum.parent = parent
    
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.48, location=(x, y - 0.1, z + 0.9))
    dome = bpy.context.active_object
    dome.data.materials.append(mat_dome_copper)
    dome.parent = parent
    
    # Golden Cross Cupola
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.25, location=(x, y - 0.1, z + 1.45))
    cross = bpy.context.active_object
    cross.data.materials.append(mat_gold)
    cross.parent = parent
    return parent


def build_roman_triumphal_arch(x=0.0, y=0.0, z=0.0):
    """Sculpts a classical Roman triumphal arch."""
    parent = bpy.data.objects.new("POI_Triumphal_Arch", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_stone = create_principled_material("Mat_Arch_Travertine", **{"Base Color": (0.84, 0.80, 0.72, 1.0), "Roughness": 0.6})
    
    # 2 side pylons
    for px in [-0.42, 0.42]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        pylon = bpy.context.active_object
        pylon.scale = (0.35, 0.45, 0.95)
        pylon.location = (x + px, y, z + 0.48)
        bpy.ops.object.transform_apply(location=True, scale=True)
        pylon.data.materials.append(mat_stone)
        pylon.parent = parent
        
    # Attic header slab
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    attic = bpy.context.active_object
    attic.scale = (1.35, 0.48, 0.35)
    attic.location = (x, y, z + 1.1)
    bpy.ops.object.transform_apply(location=True, scale=True)
    attic.data.materials.append(mat_stone)
    attic.parent = parent
    return parent


def build_piazza_fountain_monument(x=0.0, y=0.0, z=0.0):
    """Sculpts a classical Mediterranean Piazza with fountain and stone obelisk."""
    parent = bpy.data.objects.new("POI_Piazza_Fountain", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_marble = create_principled_material("Mat_Fountain_Marble", **{"Base Color": (0.88, 0.86, 0.82, 1.0), "Roughness": 0.5})
    mat_water = create_resin_water_material('mediterranean')
    mat_obelisk = create_principled_material("Mat_Obelisk_Granite", **{"Base Color": (0.62, 0.48, 0.42, 1.0), "Roughness": 0.6})
    
    # Fountain Basin
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.75, depth=0.12, location=(x, y, z + 0.06))
    basin = bpy.context.active_object
    basin.data.materials.append(mat_marble)
    basin.parent = parent
    
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.68, depth=0.08, location=(x, y, z + 0.1))
    water = bpy.context.active_object
    water.data.materials.append(mat_water)
    water.parent = parent
    
    # Central Egyptian Obelisk
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.14, depth=1.2, location=(x, y, z + 0.7))
    obelisk = bpy.context.active_object
    obelisk.data.materials.append(mat_obelisk)
    obelisk.parent = parent
    return parent


def build_roman_forum_ruins(x=0.0, y=0.0, z=0.0):
    """Sculpts authentic ancient Roman Forum ruins (fluted Corinthian colonnade, fractured architrave, fallen stone drums)."""
    parent = bpy.data.objects.new("POI_Roman_Forum_Ruins", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_stone = create_principled_material("Mat_Forum_Travertine", **{"Base Color": (0.84, 0.79, 0.70, 1.0), "Roughness": 0.7})
    mat_weathered = create_principled_material("Mat_Forum_Weathered", **{"Base Color": (0.76, 0.70, 0.62, 1.0), "Roughness": 0.85})
    
    # Stepped ruined stone stylobate/platform
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    base = bpy.context.active_object
    base.name = "Forum_Stylobate"
    base.scale = (1.4, 0.9, 0.12)
    base.location = (x, y, z + 0.06)
    bpy.ops.object.transform_apply(location=True, scale=True)
    base.data.materials.append(mat_stone)
    base.parent = parent
    
    # Standing & broken fluted temple columns
    col_configs = [
        (-0.45, -0.22, 0.95, True),   # standing column with capital
        (-0.15, -0.22, 0.95, True),   # standing column with capital
        (0.15, -0.22, 0.95, True),    # standing column with capital
        (0.45, -0.22, 0.55, False),  # broken column (mid height)
        (-0.35, 0.22, 0.42, False),  # broken ruin
        (0.25, 0.22, 0.68, False),   # ruined column
    ]
    
    for idx, (dx, dy, col_h, has_capital) in enumerate(col_configs):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=col_h, location=(x + dx, y + dy, z + 0.12 + col_h / 2.0))
        col = bpy.context.active_object
        col.name = f"Forum_Column_{idx+1}"
        col.data.materials.append(mat_stone)
        col.parent = parent
        
        if has_capital:
            bpy.ops.mesh.primitive_cube_add(size=1.0)
            cap = bpy.context.active_object
            cap.name = f"Forum_Capital_{idx+1}"
            cap.scale = (0.14, 0.14, 0.06)
            cap.location = (x + dx, y + dy, z + 0.12 + col_h + 0.03)
            bpy.ops.object.transform_apply(location=True, scale=True)
            cap.data.materials.append(mat_weathered)
            cap.parent = parent
            
    # Fractured horizontal architrave spanning across first 3 columns
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    architrave = bpy.context.active_object
    architrave.name = "Forum_Architrave"
    architrave.scale = (0.75, 0.14, 0.10)
    architrave.location = (x - 0.15, y - 0.22, z + 0.12 + 0.95 + 0.08)
    bpy.ops.object.transform_apply(location=True, scale=True)
    architrave.data.materials.append(mat_stone)
    architrave.parent = parent
    
    # Fallen column drum rubble on the ground
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.05, depth=0.22, location=(x + 0.15, y + 0.08, z + 0.12 + 0.05))
    drum = bpy.context.active_object
    drum.name = "Forum_Fallen_Drum"
    drum.rotation_euler = Euler((math.radians(85.0), 0.0, math.radians(25.0)), 'XYZ')
    drum.data.materials.append(mat_weathered)
    drum.parent = parent
    
    return parent


def build_pantheon_rotunda(x=0.0, y=0.0, z=0.0):
    """Sculpts the authentic Roman Pantheon with columned temple portico, rotunda drum, and domed oculus."""
    parent = bpy.data.objects.new("POI_Pantheon_Rotunda", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_travertine = create_principled_material("Mat_Pantheon_Travertine", **{"Base Color": (0.86, 0.82, 0.74, 1.0), "Roughness": 0.55})
    mat_rotunda_brick = create_principled_material("Mat_Pantheon_Brick", **{"Base Color": (0.78, 0.65, 0.52, 1.0), "Roughness": 0.75})
    mat_dome_bronze = create_principled_material("Mat_Pantheon_Dome_Bronze", **{"Base Color": (0.42, 0.40, 0.36, 1.0), "Metallic": 0.4, "Roughness": 0.45})
    mat_oculus_gold = create_principled_material("Mat_Pantheon_Oculus", **{"Base Color": (0.95, 0.82, 0.30, 1.0), "Metallic": 0.8, "Roughness": 0.2})
    
    # 1. Classical Temple Portico with 8 Corinthian columns (2 rows of 4)
    portico_y = y + 0.65
    for row_y in [0.0, 0.22]:
        for col_x in [-0.36, -0.12, 0.12, 0.36]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.038, depth=0.62, location=(x + col_x, portico_y + row_y, z + 0.31))
            col = bpy.context.active_object
            col.data.materials.append(mat_travertine)
            col.parent = parent
            
    # Portico Triangular Pediment & Entablature
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    entablature = bpy.context.active_object
    entablature.scale = (0.88, 0.38, 0.08)
    entablature.location = (x, portico_y + 0.11, z + 0.66)
    bpy.ops.object.transform_apply(location=True, scale=True)
    entablature.data.materials.append(mat_travertine)
    entablature.parent = parent
    
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.48, depth=0.35, location=(x, portico_y + 0.11, z + 0.78))
    ped = bpy.context.active_object
    ped.rotation_euler = Euler((math.radians(90.0), 0.0, 0.0), 'XYZ')
    ped.data.materials.append(mat_travertine)
    ped.parent = parent
    
    # 2. Intermediate Vestibule Block connecting portico to rotunda
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    vestibule = bpy.context.active_object
    vestibule.scale = (0.75, 0.4, 0.7)
    vestibule.location = (x, y + 0.35, z + 0.35)
    bpy.ops.object.transform_apply(location=True, scale=True)
    vestibule.data.materials.append(mat_rotunda_brick)
    vestibule.parent = parent
    
    # 3. Massive Circular Rotunda Drum
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.68, depth=0.72, location=(x, y - 0.15, z + 0.36))
    drum = bpy.context.active_object
    drum.name = "Pantheon_Rotunda_Drum"
    drum.data.materials.append(mat_rotunda_brick)
    drum.parent = parent
    
    # 4. Stepped Hemispherical Dome
    # Lower stepped cornice ring
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.65, depth=0.1, location=(x, y - 0.15, z + 0.77))
    step_ring = bpy.context.active_object
    step_ring.data.materials.append(mat_dome_bronze)
    step_ring.parent = parent
    
    # Hemispherical dome cap
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(x, y - 0.15, z + 0.8))
    dome = bpy.context.active_object
    dome.name = "Pantheon_Dome"
    dome.scale = (1.0, 1.0, 0.65)
    bpy.ops.object.transform_apply(location=False, scale=True)
    dome.data.materials.append(mat_dome_bronze)
    dome.parent = parent
    
    # 5. Top Center Oculus (Golden aperture ring)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.14, depth=0.06, location=(x, y - 0.15, z + 1.22))
    oculus = bpy.context.active_object
    oculus.name = "Pantheon_Oculus"
    oculus.data.materials.append(mat_oculus_gold)
    oculus.parent = parent
    
    return parent


# B. East Asian Heritage (Kyoto, Tokyo, East Asia)
def build_shinto_torii_and_shrine(x=2.5, y=-3.2, z=0.0):
    parent = bpy.data.objects.new("POI_Fushimi_Inari", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_vermilion = create_principled_material("Mat_Torii_Vermilion", **{"Base Color": (0.88, 0.18, 0.08, 1.0), "Roughness": 0.25})
    mat_cypress_roof = create_principled_material("Mat_Shrine_Bark_Roof", **{"Base Color": (0.16, 0.14, 0.13, 1.0), "Roughness": 0.75})
    
    col_radius, col_height = 0.08, 1.3
    for px in [-0.45, 0.45]:
        bpy.ops.mesh.primitive_cylinder_add(radius=col_radius, depth=col_height, location=(x + px, y, z + col_height/2.0))
        col = bpy.context.active_object
        col.data.materials.append(mat_vermilion)
        col.parent = parent
        
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    kasagi = bpy.context.active_object
    kasagi.scale = (1.35, 0.12, 0.14)
    kasagi.location = (x, y, z + col_height + 0.05)
    bpy.ops.object.transform_apply(location=True, scale=True)
    kasagi.data.materials.append(mat_vermilion)
    kasagi.parent = parent
    
    hall_x, hall_y, hall_z = x, y - 0.75, z
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hall = bpy.context.active_object
    hall.scale = (0.9, 0.8, 0.6)
    hall.location = (hall_x, hall_y, hall_z + 0.3)
    bpy.ops.object.transform_apply(location=True, scale=True)
    hall.data.materials.append(mat_vermilion)
    hall.parent = parent
    
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.85, depth=0.35, location=(hall_x, hall_y, hall_z + 0.75))
    shrine_roof = bpy.context.active_object
    shrine_roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    shrine_roof.data.materials.append(mat_cypress_roof)
    shrine_roof.parent = parent
    return parent


def build_kiyomizu_dera_complex(x=3.8, y=2.8, z=0.7):
    parent = bpy.data.objects.new("POI_Kiyomizu_Dera", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_timber = create_principled_material("Mat_Kiyomizu_Veranda_Timber", **{"Base Color": (0.32, 0.22, 0.14, 1.0), "Roughness": 0.85})
    mat_temple_roof = create_principled_material("Mat_Temple_Bark_Thatch", **{"Base Color": (0.17, 0.16, 0.15, 1.0), "Roughness": 0.7})
    mat_pagoda_red = create_principled_material("Mat_Pagoda_Lacquered_Red", **{"Base Color": (0.82, 0.16, 0.10, 1.0), "Roughness": 0.3})
    mat_gold_spire = create_principled_material("Mat_Pagoda_Sorin_Gold", **{"Base Color": (0.92, 0.75, 0.22, 1.0), "Metallic": 0.85, "Roughness": 0.2})
    
    for r in [-0.4, 0.0, 0.35]:
        for c in [-0.3, 0.3]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.8, location=(x + r, y + c, z - 0.2))
            pillar = bpy.context.active_object
            pillar.data.materials.append(mat_timber)
            pillar.parent = parent
            
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    stage = bpy.context.active_object
    stage.scale = (1.0, 0.8, 0.06)
    stage.location = (x - 0.1, y, z + 0.2)
    bpy.ops.object.transform_apply(location=True, scale=True)
    stage.data.materials.append(mat_timber)
    stage.parent = parent
    
    hall_x, hall_y, hall_z = x + 0.25, y, z + 0.23
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hall = bpy.context.active_object
    hall.scale = (0.7, 0.75, 0.5)
    hall.location = (hall_x, hall_y, hall_z + 0.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    hall.data.materials.append(mat_timber)
    hall.parent = parent
    
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.95, depth=0.45, location=(hall_x, hall_y, hall_z + 0.65))
    roof = bpy.context.active_object
    roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    roof.data.materials.append(mat_temple_roof)
    roof.parent = parent
    
    pagoda_x, pagoda_y = x + 0.8, y - 0.6
    for tier in range(3):
        tz = z + 0.2 + tier * 0.35
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        tw = bpy.context.active_object
        tw.scale = (0.42 - tier * 0.06, 0.42 - tier * 0.06, 0.22)
        tw.location = (pagoda_x, pagoda_y, tz + 0.11)
        bpy.ops.object.transform_apply(location=True, scale=True)
        tw.data.materials.append(mat_pagoda_red)
        tw.parent = parent
        
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.55 - tier * 0.08, depth=0.12, location=(pagoda_x, pagoda_y, tz + 0.25))
        tr = bpy.context.active_object
        tr.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
        tr.data.materials.append(mat_temple_roof)
        tr.parent = parent
        
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.45, location=(pagoda_x, pagoda_y, z + 1.45))
    sorin = bpy.context.active_object
    sorin.data.materials.append(mat_gold_spire)
    sorin.parent = parent
    return parent


def build_kinkaku_ji_golden_pavilion(x=-2.8, y=3.2, z=0.0):
    parent = bpy.data.objects.new("POI_Kinkaku_Ji", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_gold_leaf = create_principled_material("Mat_Kinkaku_GoldLeaf", **{"Base Color": (0.98, 0.82, 0.28, 1.0), "Metallic": 0.95, "Roughness": 0.14})
    mat_wood_first = create_principled_material("Mat_Kinkaku_Wood_FirstFloor", **{"Base Color": (0.42, 0.32, 0.22, 1.0), "Roughness": 0.7})
    mat_roof_shingle = create_principled_material("Mat_Kinkaku_Roof_Shingle", **{"Base Color": (0.24, 0.20, 0.16, 1.0), "Roughness": 0.65})
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    f1 = bpy.context.active_object
    f1.scale = (0.75, 0.65, 0.35)
    f1.location = (x, y, z + 0.2)
    bpy.ops.object.transform_apply(location=True, scale=True)
    f1.data.materials.append(mat_wood_first)
    f1.parent = parent
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    f2 = bpy.context.active_object
    f2.scale = (0.62, 0.52, 0.32)
    f2.location = (x, y, z + 0.58)
    bpy.ops.object.transform_apply(location=True, scale=True)
    f2.data.materials.append(mat_gold_leaf)
    f2.parent = parent
    
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.6, depth=0.3, location=(x, y, z + 1.05))
    roof = bpy.context.active_object
    roof.rotation_euler = Euler((0.0, 0.0, math.radians(45.0)), 'XYZ')
    roof.data.materials.append(mat_roof_shingle)
    roof.parent = parent
    return parent


# C. Modern & Western Architecture (Towers, Transport, Museums)
def build_tower_monument(x=0.0, y=0.0, z=0.0, archetype='modern_metropolis'):
    """Sculpts a vertical iconic tower / monument (Eiffel / Skyscraper / Spire)."""
    parent = bpy.data.objects.new("POI_Tower_Monument", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_metal = create_principled_material("Mat_Tower_Steel", **{"Base Color": (0.35, 0.38, 0.42, 1.0), "Metallic": 0.85, "Roughness": 0.25})
    mat_beacon = create_principled_material("Mat_Tower_Beacon", **{"Base Color": (1.0, 0.2, 0.2, 1.0), "Emission Color": (1.0, 0.2, 0.2, 1.0), "Emission Strength": 6.0})
    
    # Tier 1 base
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.65, depth=0.8, location=(x, y, z + 0.4))
    t1 = bpy.context.active_object
    t1.data.materials.append(mat_metal)
    t1.parent = parent
    
    # Observation Deck
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.35, depth=0.1, location=(x, y, z + 0.85))
    deck = bpy.context.active_object
    deck.data.materials.append(mat_metal)
    deck.parent = parent
    
    # Slender upper spire
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.25, depth=1.2, location=(x, y, z + 1.45))
    spire = bpy.context.active_object
    spire.data.materials.append(mat_metal)
    spire.parent = parent
    
    # Beacon
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(x, y, z + 2.08))
    b = bpy.context.active_object
    b.data.materials.append(mat_beacon)
    b.parent = parent
    return parent


def build_palace_museum_hall(x=0.0, y=0.0, z=0.0, archetype='european_classical'):
    """Sculpts a classical museum / palace hall with columned facade and courtyard."""
    parent = bpy.data.objects.new("POI_Palace_Museum", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_stone = create_principled_material("Mat_Palace_Stone", **{"Base Color": (0.86, 0.83, 0.77, 1.0), "Roughness": 0.6})
    mat_slate = create_principled_material("Mat_Palace_Slate_Roof", **{"Base Color": (0.24, 0.28, 0.32, 1.0), "Roughness": 0.5})
    
    # Main gallery wing
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hall = bpy.context.active_object
    hall.scale = (1.4, 0.7, 0.45)
    hall.location = (x, y, z + 0.23)
    bpy.ops.object.transform_apply(location=True, scale=True)
    hall.data.materials.append(mat_stone)
    hall.parent = parent
    
    # Classical Pediment
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.45, depth=0.1, location=(x, y + 0.36, z + 0.52))
    ped = bpy.context.active_object
    ped.rotation_euler = Euler((math.radians(90.0), 0.0, 0.0), 'XYZ')
    ped.data.materials.append(mat_stone)
    ped.parent = parent
    return parent


def build_modern_transport_hub(x=-1.5, y=-2.8, z=0.0):
    parent = bpy.data.objects.new("POI_Modern_Station", None)
    bpy.context.scene.collection.objects.link(parent)
    mat_station_glass = create_principled_material("Mat_Station_Glass", **{"Base Color": (0.6, 0.85, 0.95, 1.0), "Roughness": 0.08, "Transmission Weight": 0.85, "IOR": 1.52})
    mat_steel_frame = create_principled_material("Mat_Station_Steel", **{"Base Color": (0.28, 0.30, 0.34, 1.0), "Metallic": 0.8, "Roughness": 0.3})
    mat_shinkansen = create_principled_material("Mat_Shinkansen_White", **{"Base Color": (0.95, 0.96, 0.98, 1.0), "Roughness": 0.15})
    mat_train_blue = create_principled_material("Mat_Shinkansen_Stripe_Blue", **{"Base Color": (0.05, 0.35, 0.82, 1.0), "Roughness": 0.2})
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    station = bpy.context.active_object
    station.scale = (1.4, 0.85, 0.65)
    station.location = (x, y, z + 0.33)
    bpy.ops.object.transform_apply(location=True, scale=True)
    station.data.materials.append(mat_steel_frame)
    station.parent = parent
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    atrium = bpy.context.active_object
    atrium.scale = (1.2, 0.25, 0.55)
    atrium.location = (x, y + 0.35, z + 0.35)
    bpy.ops.object.transform_apply(location=True, scale=True)
    atrium.data.materials.append(mat_station_glass)
    atrium.parent = parent
    
    train_x, train_y = x + 0.2, y - 0.55
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    train = bpy.context.active_object
    train.scale = (1.3, 0.16, 0.15)
    train.location = (train_x, train_y, z + 0.08)
    bpy.ops.object.transform_apply(location=True, scale=True)
    train.data.materials.append(mat_shinkansen)
    train.parent = parent
    return parent


def build_generic_landmark_pavilion(x=0.0, y=0.0, z=0.0, archetype='mediterranean', name='Landmark'):
    """Universal architectural landmark sculptor for any general POI in the world."""
    parent = bpy.data.objects.new(f"POI_{name.replace(' ', '_')}", None)
    bpy.context.scene.collection.objects.link(parent)
    
    mat_wall = create_principled_material("Mat_Generic_Wall", **{"Base Color": (0.85, 0.80, 0.72, 1.0), "Roughness": 0.6})
    mat_trim = create_principled_material("Mat_Generic_Trim", **{"Base Color": (0.45, 0.25, 0.18, 1.0), "Roughness": 0.4})
    
    # Raised stone plinth
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.65, depth=0.15, location=(x, y, z + 0.08))
    plinth = bpy.context.active_object
    plinth.data.materials.append(mat_wall)
    plinth.parent = parent
    
    # Dimensional Rotunda Pavilion
    for angle in [0, 60, 120, 180, 240, 300]:
        rad = math.radians(angle)
        px = x + 0.45 * math.cos(rad)
        py = y + 0.45 * math.sin(rad)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.55, location=(px, py, z + 0.4))
        c = bpy.context.active_object
        c.data.materials.append(mat_wall)
        c.parent = parent
        
    # Classical Dome Cap
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.48, location=(x, y, z + 0.75))
    cap = bpy.context.active_object
    cap.data.materials.append(mat_trim)
    cap.parent = parent
    return parent


# ==============================================================================
# 7. DYNAMIC LANDMARK DISPATCHER (ANY ITINERARY / ANY CITY)
# ==============================================================================

def dispatch_landmark_sculptor(stop, archetype='east_asian'):
    """
    Dynamically maps any POI name/category to an authentic 3D architectural model
    placed at the exact normalized coordinate of the user's itinerary.
    """
    display_name = stop.get('name') or stop.get('place_name') or 'Landmark'
    name = display_name.lower()
    cat = (stop.get('category') or stop.get('place_category') or 'attraction').lower()
    x = stop.get('x', 0.0)
    y = stop.get('y', 0.0)
    z = stop.get('z', 0.0)
    
    # 1. Colosseum & Ancient Amphitheaters
    if any(k in name for k in ['colosseum', 'amphitheatre', 'amphitheater', 'arena']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Colosseum Amphitheater at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_colosseum_amphitheater(x, y, z)
        
    # 2. Ancient Ruins & Roman Forum
    if any(k in name for k in ['forum', 'ruin', 'ruins', 'foro', 'palatine']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Roman Forum Ancient Ruins at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_roman_forum_ruins(x, y, z)

    # 3. Pantheon & Classical Rotunda
    if 'pantheon' in name:
        print(f"[Engine] Sculpting POI '{display_name}' -> Pantheon Rotunda at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_pantheon_rotunda(x, y, z)
        
    # 4. Cathedrals, Basilicas, Churches & Religious Domes
    if any(k in name for k in ['basilica', 'cathedral', 'duomo', 'vatican', 'church', 'chapel', 'notre dame', 'sagrada']):
        if archetype == 'east_asian':
            print(f"[Engine] Sculpting POI '{display_name}' -> Shinto Shrine at ({x:.2f}, {y:.2f}, {z:.2f})")
            return build_shinto_torii_and_shrine(x, y, z)
        print(f"[Engine] Sculpting POI '{display_name}' -> Classical Basilica Dome at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_classical_basilica_dome(x, y, z)
        
    # 5. Shrines & Torii (East Asia)
    if any(k in name for k in ['torii', 'inari', 'shrine', 'jinja']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Shinto Torii & Shrine at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_shinto_torii_and_shrine(x, y, z)
        
    # 6. Pagodas & Buddhist Temples
    if any(k in name for k in ['pagoda', 'temple', 'kiyomizu', 'senso-ji', 'todai', 'wat']):
        if archetype == 'east_asian':
            print(f"[Engine] Sculpting POI '{display_name}' -> Kiyomizu-dera Complex at ({x:.2f}, {y:.2f}, {z:.2f})")
            return build_kiyomizu_dera_complex(x, y, z)
        print(f"[Engine] Sculpting POI '{display_name}' -> Classical Basilica Dome at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_classical_basilica_dome(x, y, z)
        
    # 7. Golden Pavilions & Water Monuments
    if any(k in name for k in ['kinkaku', 'pavilion', 'golden', 'pond', 'palacio']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Golden Pavilion at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_kinkaku_ji_golden_pavilion(x, y, z)
        
    # 8. Arches & Portals
    if any(k in name for k in ['arch', 'arc de', 'triumph', 'porta', 'gate']):
        if archetype == 'east_asian':
            print(f"[Engine] Sculpting POI '{display_name}' -> Shinto Torii & Shrine at ({x:.2f}, {y:.2f}, {z:.2f})")
            return build_shinto_torii_and_shrine(x, y, z)
        print(f"[Engine] Sculpting POI '{display_name}' -> Roman Triumphal Arch at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_roman_triumphal_arch(x, y, z)
        
    # 9. Piazzas, Squares, Fountains & Markets
    if any(k in name for k in ['piazza', 'square', 'fountain', 'trevi', 'market', 'navona', 'plaza', 'fiori']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Piazza Fountain Monument at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_piazza_fountain_monument(x, y, z)
        
    # 10. Towers & Skyscraper Spires
    if any(k in name for k in ['tower', 'eiffel', 'spire', 'campanile', 'skyscraper', 'empire', 'burj']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Tower Monument at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_tower_monument(x, y, z, archetype)
        
    # 11. Museums, Palaces & Galleries
    if any(k in name for k in ['museum', 'palace', 'gallery', 'uffizi', 'louvre', 'prado', 'hermitage', 'castle']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Palace Museum Hall at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_palace_museum_hall(x, y, z, archetype)
        
    # 12. Transit Hubs & Airports
    if cat == 'transit' or any(k in name for k in ['station', 'terminal', 'airport', 'central', 'hub']):
        print(f"[Engine] Sculpting POI '{display_name}' -> Modern Transport Hub at ({x:.2f}, {y:.2f}, {z:.2f})")
        return build_modern_transport_hub(x, y, z)
        
    # 13. Generic Architectural Pavilion for any other stop
    print(f"[Engine] Sculpting POI '{display_name}' -> Generic Landmark Pavilion at ({x:.2f}, {y:.2f}, {z:.2f})")
    return build_generic_landmark_pavilion(x, y, z, archetype, name)


# ==============================================================================
# 8. VOLUMETRIC FLOW & ROUTE HIGHLIGHTS
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
    
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    curve_data.extrude = 0.07
    curve_obj.data.materials.append(mat_ribbon)
    
    # 2. Physical 3D Waypoint Pins & Stop Numbers
    for i, wp in enumerate(waypoints):
        wx, wy, wz = wp['x'], wp['y'], wp.get('z', 0.0)
        
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.03, location=(wx, wy, wz + 0.02))
        base_ring = bpy.context.active_object
        base_ring.name = f"Waypoint_Base_{i+1}"
        base_ring.data.materials.append(mat_pin_metal)
        
        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.5, location=(wx, wy, wz + 0.28))
        stem = bpy.context.active_object
        stem.name = f"Waypoint_Stem_{i+1}"
        stem.data.materials.append(mat_pin_metal)
        
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(wx, wy, wz + 0.58))
        orb = bpy.context.active_object
        orb.name = f"Waypoint_Orb_{i+1}"
        orb.data.materials.append(mat_pin_orb)
        
        bpy.ops.object.text_add(location=(wx - 0.05, wy - 0.05, wz + 0.8))
        txt = bpy.context.active_object
        txt.name = f"Waypoint_Number_{i+1}"
        txt.data.body = str(i + 1)
        txt.data.size = 0.22
        txt.data.extrude = 0.04
        txt.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        txt.data.materials.append(mat_pin_text)


# ==============================================================================
# 9. DIMENSIONAL FLOATING HUD & UI PANELS
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
    
    region = (params.get("region_name") or "KYOTO, JAPAN").upper()
    day_num = params.get("day_number", 1)
    title = f"{region} · DAY {day_num}"
    metrics_str = params.get("key_metrics") or "5.4 KM · 11,200 STEPS · +142M ELEV"
    pills = params.get("filter_labels") or ["[ITINERARY]", "[CLEAR 18°C]", "[PACING: OPTIMAL]"]
    
    # 1. Master HUD Plaque (Floating in the upper-left quadrant)
    hud_x, hud_y, hud_z = -4.0, 1.2, 3.0
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hud_slab = bpy.context.active_object
    hud_slab.name = "HUD_Master_Plaque"
    hud_slab.scale = (3.4, 1.4, 0.08)
    hud_slab.location = (hud_x, hud_y, hud_z)
    hud_slab.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    bpy.ops.object.transform_apply(location=False, scale=True)
    hud_slab.data.materials.append(mat_glass)
    
    bpy.ops.object.modifier_add(type='BEVEL')
    hud_slab.modifiers["Bevel"].width = 0.03
    hud_slab.modifiers["Bevel"].segments = 2
    
    # Title
    bpy.ops.object.text_add(location=(hud_x - 1.0, hud_y - 0.2, hud_z + 0.4))
    title_obj = bpy.context.active_object
    title_obj.name = "HUD_Title_Text"
    title_obj.data.body = title
    title_obj.data.size = 0.2
    title_obj.data.extrude = 0.02
    title_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    title_obj.data.materials.append(mat_hud_text)
    
    # Metrics
    bpy.ops.object.text_add(location=(hud_x - 0.9, hud_y - 0.35, hud_z + 0.1))
    metrics_obj = bpy.context.active_object
    metrics_obj.name = "HUD_Metrics_Text"
    metrics_obj.data.body = metrics_str
    metrics_obj.data.size = 0.13
    metrics_obj.data.extrude = 0.015
    metrics_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
    metrics_obj.data.materials.append(mat_hud_cyan)
    
    # Status Pill Badges
    for idx, pill_text in enumerate(pills):
        bpy.ops.object.text_add(location=(hud_x - 0.8 + idx * 0.95, hud_y - 0.5 - idx * 0.15, hud_z - 0.2))
        pill_obj = bpy.context.active_object
        pill_obj.name = f"HUD_Pill_{idx+1}"
        pill_obj.data.body = str(pill_text)
        pill_obj.data.size = 0.09
        pill_obj.data.extrude = 0.01
        pill_obj.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        pill_obj.data.materials.append(mat_hud_text)
        
    # 2. Dimensional Landmark Floating Callouts
    custom_callouts = params.get("callouts") if params else None
    if not custom_callouts and params and params.get("waypoints"):
        custom_callouts = []
        for wp in params.get("waypoints", [])[:3]:
            custom_callouts.append({
                "x": wp.get("x", 0.0),
                "y": wp.get("y", 0.0),
                "z": wp.get("z", 0.0),
                "title": (wp.get("name") or wp.get("place_name") or "Landmark").split(' (')[0],
                "tag": (wp.get("arrival_time") or "09:00 AM") + " · " + (wp.get("category") or wp.get("place_category") or "Visit").capitalize()
            })
    callouts = custom_callouts or [
        {"x": 3.8, "y": 2.8, "z": 0.7, "title": "Kiyomizu-dera", "tag": "09:00 AM · Cash Only"},
        {"x": 2.5, "y": -3.2, "z": 0.0, "title": "Fushimi Inari", "tag": "14:00 PM · Free Entry"},
        {"x": -2.8, "y": 3.2, "z": 0.0, "title": "Kinkaku-ji", "tag": "11:30 AM · Ticket Req"},
    ]
    
    for c in callouts:
        cx, cy, cz = c["x"], c["y"], c["z"]
        bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=1.4, location=(cx, cy, cz + 1.2))
        tether = bpy.context.active_object
        tether.name = f"Callout_Tether_{c['title']}"
        tether.data.materials.append(mat_hud_cyan)
        
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        card = bpy.context.active_object
        card.name = f"Callout_Card_{c['title']}"
        card.scale = (1.5, 0.45, 0.05)
        card.location = (cx, cy, cz + 2.0)
        card.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        bpy.ops.object.transform_apply(location=False, scale=True)
        card.data.materials.append(mat_glass)
        
        bpy.ops.object.text_add(location=(cx - 0.45, cy + 0.1, cz + 2.05))
        lbl = bpy.context.active_object
        lbl.name = f"Callout_Label_{c['title']}"
        lbl.data.body = c['title']
        lbl.data.size = 0.12
        lbl.data.extrude = 0.015
        lbl.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        lbl.data.materials.append(mat_hud_text)
        
        bpy.ops.object.text_add(location=(cx - 0.42, cy + 0.02, cz + 1.9))
        sub = bpy.context.active_object
        sub.name = f"Callout_Sub_{c['title']}"
        sub.data.body = c['tag']
        sub.data.size = 0.08
        sub.data.extrude = 0.01
        sub.rotation_euler = Euler((math.radians(56.0), 0.0, math.radians(45.0)), 'XYZ')
        sub.data.materials.append(mat_hud_cyan)


# ==============================================================================
# 10. MASTER ORCHESTRATION PIPELINE
# ==============================================================================

def normalize_waypoints_coordinates(waypoints):
    """
    Normalizes arbitrary lat/lng coordinates to a [-3.6, 3.6] diorama local grid
    if x and y coordinates are not already specified.
    """
    if not waypoints:
        return waypoints
    has_xy = all(('x' in wp and 'y' in wp) for wp in waypoints)
    if has_xy:
        return waypoints
        
    coords = []
    for wp in waypoints:
        lat = wp.get('lat') if 'lat' in wp else wp.get('latitude', 0.0)
        lng = wp.get('lng') if 'lng' in wp else wp.get('longitude', 0.0)
        coords.append((lat, lng))
        
    if not coords or len(coords) == 1:
        for wp in waypoints:
            wp.setdefault('x', 0.0)
            wp.setdefault('y', 0.0)
            wp.setdefault('z', 0.0)
        return waypoints
        
    lats = [c[0] for c in coords]
    lngs = [c[1] for c in coords]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)
    span_lat = max_lat - min_lat or 0.01
    span_lng = max_lng - min_lng or 0.01
    max_span = max(span_lat, span_lng)
    center_lat = (min_lat + max_lat) / 2.0
    center_lng = (min_lng + max_lng) / 2.0
    target_radius = 3.6
    
    for i, wp in enumerate(waypoints):
        lat, lng = coords[i]
        if 'x' not in wp:
            wp['x'] = round(((lng - center_lng) / max_span) * target_radius * 2.0, 2)
        if 'y' not in wp:
            wp['y'] = round(((lat - center_lat) / max_span) * target_radius * 2.0, 2)
        if 'z' not in wp:
            wp['z'] = 0.0
            
    return waypoints


def generate_diorama(input_params=None, output_filepath=None, samples=64, resolution=(1920, 1080)):
    """
    Executes the complete universal 3D isometric diorama generation pipeline.
    """
    params = input_params or {}
    region_name = params.get("region_name", "Kyoto, Japan")
    archetype = classify_destination_archetype(region_name)
    
    print("=" * 75)
    print("3D ENVIRONMENTAL DESIGN & CARTOGRAPHIC VISUALIZATION ENGINE")
    print(f"[Engine] Destination: {region_name} -> Classified Archetype: '{archetype.upper()}'")
    print(f"[Engine] Resolution: {resolution[0]}x{resolution[1]} | Samples: {samples}")
    print("=" * 75)
    
    # 1. Setup Scene & Isometric Camera
    setup_diorama_scene(resolution=resolution, samples=samples, use_metal=True)
    
    # 2. Build Floating Chunk Base & Cross-Section with Regional Strata
    print(f"[Engine] Generating floating {archetype} geological chunk base...")
    create_floating_chunk_base(archetype=archetype, width=10.0, length=10.0, base_depth=2.4)
    
    # 3. Carve River & Water Cross-Section
    print(f"[Engine] Carving {archetype} resin river channel and cross-section...")
    create_river_water_cross_section(archetype=archetype, width=10.0, river_width=1.4, river_depth=0.35)
    
    # 4. Lay Miniature Infrastructure & Urban Blocks
    print(f"[Engine] Laying miniature roads and {archetype} architectural town blocks...")
    create_road_corridors_and_blocks(archetype=archetype)
    
    # 5. Build Selectively Enlarged 3D Architectural POIs
    # If custom waypoints are provided in the payload, sculpt each custom POI dynamically!
    waypoints = params.get("waypoints")
    if waypoints and len(waypoints) > 0:
        waypoints = normalize_waypoints_coordinates(waypoints)
        params["waypoints"] = waypoints
        print(f"[Engine] Dynamically sculpting {len(waypoints)} custom 3D architectural POIs along itinerary...")
        for st in waypoints:
            dispatch_landmark_sculptor(st, archetype=archetype)
    else:
        # Default starter landmarks for default archetype
        print("[Engine] Sculpting landmark models for default highlights...")
        if archetype == 'mediterranean':
            build_colosseum_amphitheater(x=2.5, y=-2.5, z=0.0)
            build_classical_basilica_dome(x=-2.5, y=2.5, z=0.0)
            build_roman_triumphal_arch(x=1.5, y=0.5, z=0.0)
            build_piazza_fountain_monument(x=-0.8, y=1.5, z=0.0)
        else:
            build_shinto_torii_and_shrine(x=2.5, y=-3.2, z=0.0)
            build_kiyomizu_dera_complex(x=3.8, y=2.8, z=0.7)
            build_kinkaku_ji_golden_pavilion(x=-2.8, y=3.2, z=0.0)
            build_modern_transport_hub(x=-1.5, y=-2.8, z=0.0)
            waypoints = [
                {"x": -1.5, "y": -2.8, "z": 0.0, "name": "Kyoto Station"},
                {"x": 2.5, "y": -3.2, "z": 0.0, "name": "Fushimi Inari Taisha"},
                {"x": 1.5, "y": 0.5, "z": 0.0, "name": "Gion Shijo Junction"},
                {"x": 3.8, "y": 2.8, "z": 0.7, "name": "Kiyomizu-dera"},
                {"x": -0.8, "y": 2.0, "z": 0.0, "name": "Nishiki Market Area"},
                {"x": -2.8, "y": 3.2, "z": 0.0, "name": "Kinkaku-ji"},
            ]
            
    # 6. Build Volumetric Glowing Route Ribbon & Waypoints
    print("[Engine] Tracing volumetric neon glass route ribbon and physical 3D waypoint pins...")
    create_volumetric_route_ribbon_and_waypoints(waypoints)
    
    # 7. Build Dimensional Floating Glassmorphic HUD & Callout Panels
    print("[Engine] Projecting physical frosted-glass HUD and dimensional landmark callouts...")
    create_floating_hud_panels(params)
    
    # 8. Render Scene via Cycles Metal
    out_path = output_filepath or os.path.abspath("public/dioramas/kyoto_day1_isometric_chunk.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    bpy.context.scene.render.filepath = out_path
    print(f"[Engine] Commencing Cycles Metal physical render -> {out_path} ...")
    
    bpy.ops.render.render(write_still=True)
    print(f"[Engine] Render successfully written to: {out_path}")
    print("=" * 75)
    return out_path


# ==============================================================================
# 11. CLI ENTRY POINT (Blender headless execution)
# ==============================================================================

def main():
    args_list = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="TripPlanner Universal 3D Isometric Diorama Engine")
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
