"""Cut-paper figures for the Konark story (Blender): horse, wheel, Surya, people, temple.

Each figure is an empty (its root) with pieces of card parented to it a few millimetres apart,
so they shadow one another. Moving parts (legs, arms, wheels) get their own empties as pivots;
rotating a pivot about the world Y axis turns it in the picture plane.
"""
import math

import paper as P
from paper import woman


def _shift(pts, dx, dy):
    return [(x + dx, y + dy) for x, y in pts]


# ------------------------------------------------------------------ horse

def horse(name, parent=None, at=(0, 0), depth=0.0, coat="#f4e9d4", mane="#d7b27a", jewel="#e0a032", cloth="#b0303a", scale=1.0):
    """A galloping horse facing right, hooves at y = 0, about 1.9 long. Legs in root['legs']."""
    root = P.group(name, depth=depth, at=at, parent=parent)
    root.scale = (scale, scale, scale)
    far = "#" + "".join("%02x" % int(int(coat[i:i + 2], 16) * 0.78) for i in (1, 3, 5))
    legs = []

    def leg(tag, x, y, d, color):
        hip = P.group(f"{name} {tag} hip", depth=d, at=(x, y), parent=root)
        P.piece(f"{name} {tag} thigh", [P.capsule(0, 0, 0, -0.38, 0.12, 0.06)], color, parent=hip)
        knee = P.group(f"{name} {tag} knee", depth=-0.004, at=(0, -0.38), parent=hip)
        P.piece(f"{name} {tag} shin", [P.capsule(0, 0, 0, -0.36, 0.055, 0.045)], color, parent=knee)
        P.piece(f"{name} {tag} hoof", [[(-0.07, -0.34), (0.08, -0.34), (0.07, -0.44), (-0.06, -0.44)]], "#5b3d22", depth=-0.004, parent=knee)
        hip["knee"] = knee.name
        legs.append(hip)

    leg("ff", 0.46, 0.86, 0.04, far)
    leg("fb", -0.42, 0.9, 0.04, far)
    body = P.smooth([(-0.55, 1.12), (-0.15, 1.07), (0.22, 1.16), (0.42, 1.44), (0.6, 1.72), (0.72, 1.8), (0.8, 1.74),
                     (0.95, 1.55), (1.07, 1.41), (1.03, 1.34), (0.9, 1.36), (0.76, 1.42), (0.68, 1.34), (0.63, 1.12),
                     (0.62, 0.92), (0.42, 0.76), (0.0, 0.71), (-0.36, 0.75), (-0.6, 0.84), (-0.68, 1.0)], 10)
    P.piece(f"{name} body", [body], coat, parent=root)
    P.piece(f"{name} ear1", [[(0.66, 1.76), (0.66, 1.96), (0.75, 1.79)]], coat, depth=0.004, parent=root)
    P.piece(f"{name} ear2", [[(0.72, 1.78), (0.76, 1.95), (0.8, 1.77)]], coat, depth=-0.002, parent=root)
    P.piece(f"{name} tail", [P.smooth([(-0.6, 1.08), (-0.86, 1.26), (-1.12, 1.2), (-1.04, 1.04), (-0.8, 1.0), (-0.64, 0.95)], 8)], mane, depth=0.003, parent=root)
    for i in range(5):
        t = i / 4
        P.piece(f"{name} mane{i}", [P.ellipse(0.24 + t * 0.4 - 0.06, 1.2 + t * 0.52 + 0.03, 0.14, 0.055, 1.0, 24)], mane, depth=-0.006 - i * 0.001, parent=root)
    P.piece(f"{name} crest", [P.ellipse(0.69, 2.0, 0.055, 0.15, -0.3, 24)], cloth, depth=-0.006, parent=root)
    # harness: bridle, a jewelled collar with bells, a saddle cloth with a gold border, an eye
    for k, seg in enumerate([(0.94, 1.52, 0.78, 1.66, 0.022), (0.94, 1.52, 0.9, 1.36, 0.02), (0.6, 1.04, 0.42, 1.34, 0.04)]):
        P.piece(f"{name} strap{k}", [P.capsule(*seg)], jewel, depth=-0.008, glow=0.1, parent=root)
    for k in range(3):
        P.piece(f"{name} bell{k}", [P.circle(0.55 - k * 0.06, 1.0 + k * 0.12, 0.04, 16)], jewel, depth=-0.01, glow=0.15, parent=root)
    P.piece(f"{name} cloth", [P.smooth([(-0.3, 1.13), (0.14, 1.15), (0.12, 0.86), (-0.06, 0.8), (-0.28, 0.86)], 6)], cloth, depth=-0.008, parent=root)
    P.piece(f"{name} cloth hem", [P.capsule(-0.3, 0.86, 0.12, 0.86, 0.025)], jewel, depth=-0.01, parent=root)
    P.piece(f"{name} eye", [P.circle(0.83, 1.6, 0.025, 12)], "#2b170a", depth=-0.008, parent=root)
    leg("nf", 0.4, 0.84, -0.012, coat)
    leg("nb", -0.46, 0.88, -0.012, coat)
    root["legs"] = [h.name for h in legs]
    return root


def gallop_keys(root, frames, fps, speed=7.0, phase=0.0, step=2):
    """Keyframe a gallop: legs swing, knees fold, the body bobs and pitches."""
    import bpy

    legs = [bpy.data.objects[n] for n in root["legs"]]
    off = [0, math.pi, 0.6, math.pi + 0.6]
    front = [True, False, True, False]
    base = tuple(root.location)
    for f in range(1, frames + 1, step):
        p0 = f / fps * speed + phase
        for i, hip in enumerate(legs):
            p = p0 + off[i]
            a = 0.55 * math.sin(p) + 0.15 if front[i] else 0.5 * math.sin(p) - 0.1
            knee = bpy.data.objects[hip["knee"]]
            k = -max(0, math.sin(p + 1.2)) * 1.3 if front[i] else max(0, math.sin(p - 1.0)) * 0.9
            P.key(hip, f, rotation_euler=(0, -a, 0))
            P.key(knee, f, rotation_euler=(0, -k, 0))
        P.key(root, f, location=(base[0], base[1], base[2] + abs(math.sin(p0)) * 0.06), rotation_euler=(0, -math.sin(p0 + 0.8) * 0.03, 0))


# ------------------------------------------------------------------ wheel

def wheel(name, r, parent=None, at=(0, 0), depth=0.0, colors=("#a87d52", "#caa47a", "#5b3d22"), beads=True, glow=0.0):
    """A chariot wheel face-on: rim, 8 great and 8 fine spokes, medallions, hub, beads.
    The turning part is root['spin']."""
    stone, light, dark = colors
    root = P.group(name, depth=depth, at=at, parent=parent)
    spin = P.group(f"{name} spin", parent=root)
    P.piece(f"{name} rim", [P.circle(0, 0, r, 128), P.circle(0, 0, r * 0.83, 128)], stone, glow=glow, parent=spin)
    P.piece(f"{name} rim2", [P.circle(0, 0, r * 0.86, 128), P.circle(0, 0, r * 0.8, 128)], dark, depth=0.012, parent=spin)
    for i in range(16):
        a = i / 16 * math.tau
        c, s = math.cos(a), math.sin(a)
        if i % 2:
            P.piece(f"{name} fine{i}", [P.capsule(c * r * 0.2, s * r * 0.2, c * r * 0.84, s * r * 0.84, r * 0.025)], light, depth=-0.006, glow=glow, parent=spin)
        else:
            P.piece(f"{name} spoke{i}", [P.capsule(c * r * 0.2, s * r * 0.2, c * r * 0.84, s * r * 0.84, r * 0.06, r * 0.045)], stone, depth=-0.012, glow=glow, parent=spin)
            P.piece(f"{name} med{i}", [P.circle(c * r * 0.52, s * r * 0.52, r * 0.1, 32), P.circle(c * r * 0.52, s * r * 0.52, r * 0.05, 24)], light, depth=-0.02, glow=glow, parent=spin)
    P.piece(f"{name} hub", [P.circle(0, 0, r * 0.22, 48)], stone, depth=-0.02, glow=glow, parent=spin)
    P.piece(f"{name} hub ring", [P.circle(0, 0, r * 0.16, 48), P.circle(0, 0, r * 0.1, 48)], light, depth=-0.028, glow=glow, parent=spin)
    P.piece(f"{name} axle", [P.circle(0, 0, r * 0.07, 24)], dark, depth=-0.034, parent=spin)
    if beads:
        for i in range(48):
            a = i / 48 * math.tau
            P.piece(f"{name} bead{i}", [P.circle(math.cos(a) * r * 0.915, math.sin(a) * r * 0.915, r * 0.026, 12)], light, depth=-0.006, glow=glow, parent=spin)
    root["spin"] = spin.name
    return root


# ------------------------------------------------------------------ Surya

def surya(name, parent=None, at=(0, 0), depth=0.0, scale=1.0):
    """Surya seated in lotus pose: a halo of lotus petals and rays, a jewelled crown, red and gold
    robes, armlets and necklaces, and a full-blown lotus held up in each hand."""
    root = P.group(name, depth=depth, at=at, parent=parent)
    root.scale = (scale, scale, scale)
    gold, red, deep = "#f0b84a", "#b8283a", "#7a1424"
    skin = "#d8954e"
    # the halo: rays, a ring of petals, a disc, an inner ring
    P.piece(f"{name} rays", [P.star(0, 1.5, 0.74, 0.54, 28)], "#f2a43a", depth=0.04, glow=0.8, parent=root)
    for k in range(18):
        a = k / 18 * math.tau
        P.piece(f"{name} hpetal{k}", [P.ellipse(math.cos(a) * 0.5, 1.5 + math.sin(a) * 0.5, 0.1, 0.05, a, 16)], "#ffd27a", depth=0.035, glow=0.9, parent=root)
    P.piece(f"{name} halo", [P.circle(0, 1.5, 0.46, 64)], "#ffcf6a", depth=0.03, glow=1.1, parent=root)
    P.piece(f"{name} halo ring", [P.circle(0, 1.5, 0.4, 64), P.circle(0, 1.5, 0.37, 64)], gold, depth=0.028, glow=0.8, parent=root)
    # crossed legs in lotus pose, wrapped in the red robe with a gold border
    P.piece(f"{name} legs", [P.smooth([(-0.46, 0.58), (0.46, 0.58), (0.42, 0.74), (0.2, 0.8), (-0.2, 0.8), (-0.42, 0.74)], 6)], red, parent=root)
    P.piece(f"{name} robe border", [P.capsule(-0.44, 0.61, 0.44, 0.61, 0.025)], gold, depth=-0.004, glow=0.2, parent=root)
    for k in range(6):
        P.piece(f"{name} robe dot{k}", [P.circle(-0.3 + k * 0.12, 0.7, 0.018, 10)], gold, depth=-0.004, parent=root)
    for side in (-1, 1):
        P.piece(f"{name} foot{side}", [P.ellipse(side * 0.16, 0.76, 0.09, 0.035, side * 0.3, 16)], skin, depth=-0.006, parent=root)
    # torso, a gold breastplate, necklaces
    P.piece(f"{name} body", [P.smooth([(-0.26, 0.78), (0.26, 0.78), (0.3, 1.2), (0.15, 1.34), (-0.15, 1.34), (-0.3, 1.2)], 6)], skin, depth=-0.002, parent=root)
    P.piece(f"{name} waist", [P.rect(-0.27, 0.78, 0.54, 0.09)], gold, depth=-0.006, glow=0.2, parent=root)
    for r, n_, y in ((0.16, 9, 1.27), (0.22, 11, 1.2)):
        for k in range(n_):
            a = math.pi * (1.1 + 0.8 * k / (n_ - 1))
            P.piece(f"{name} neck{r}{k}", [P.circle(math.cos(a) * r, y + 0.1 + math.sin(a) * r * 0.6, 0.02, 10)], gold, depth=-0.008, glow=0.25, parent=root)
    P.piece(f"{name} pendant", [P.circle(0, 1.08, 0.04, 16)], "#e86a7a", depth=-0.01, parent=root)
    P.piece(f"{name} sash", [P.capsule(-0.22, 1.28, 0.2, 0.86, 0.035)], deep, depth=-0.007, parent=root)
    # head: face, eyes, a tall jewelled crown, earrings
    P.piece(f"{name} head", [P.ellipse(0, 1.5, 0.15, 0.17, 0, 40)], skin, depth=-0.006, parent=root)
    for side in (-1, 1):
        P.piece(f"{name} eye{side}", [P.ellipse(side * 0.06, 1.52, 0.035, 0.013, 0, 12)], "#2a160a", depth=-0.009, parent=root)
        P.piece(f"{name} ear{side}", [P.circle(side * 0.16, 1.44, 0.03, 12)], gold, depth=-0.009, glow=0.3, parent=root)
    P.piece(f"{name} tilak", [P.ellipse(0, 1.58, 0.012, 0.03, 0, 10)], "#c4282e", depth=-0.009, parent=root)
    P.piece(f"{name} crown", [[(-0.17, 1.62), (0.17, 1.62), (0.15, 1.86), (0.09, 1.78), (0.05, 1.94), (0, 2.08), (-0.05, 1.94), (-0.09, 1.78), (-0.15, 1.86)]], gold, depth=-0.012, glow=0.35, parent=root)
    P.piece(f"{name} crown band", [P.rect(-0.17, 1.62, 0.34, 0.05)], deep, depth=-0.014, parent=root)
    for k in range(5):
        P.piece(f"{name} jewel{k}", [P.circle(-0.12 + k * 0.06, 1.645, 0.014, 10)], "#e86a7a", depth=-0.016, parent=root)
    # arms raised, armlets and bracelets, and a lotus in each hand
    for k, seg in enumerate([(-0.26, 1.24, -0.44, 0.98, 0.06), (-0.44, 0.98, -0.44, 1.4, 0.05), (0.26, 1.24, 0.44, 0.98, 0.06), (0.44, 0.98, 0.44, 1.4, 0.05)]):
        P.piece(f"{name} arm{k}", [P.capsule(*seg)], skin, depth=-0.008, parent=root)
    for side in (-1, 1):
        P.piece(f"{name} armlet{side}", [P.ellipse(side * 0.34, 1.12, 0.06, 0.03, side * 0.8, 12)], gold, depth=-0.01, glow=0.25, parent=root)
        P.piece(f"{name} bracelet{side}", [P.rect(side * 0.44 - 0.055, 1.24, 0.11, 0.035)], gold, depth=-0.01, glow=0.25, parent=root)
        x = side * 0.44
        P.piece(f"{name} leaf{side}", [P.ellipse(x + side * 0.12, 1.42, 0.12, 0.05, side * 0.5, 20)], "#4f8a4a", depth=-0.011, parent=root)
        for k, a in enumerate((-0.9, -0.5, -0.15, 0.15, 0.5, 0.9)):
            P.piece(f"{name} lotus{side}{k}", [P.ellipse(x + math.sin(a) * 0.1, 1.55 + math.cos(a) * 0.07, 0.05, 0.13, -a, 20)], "#f2a0aa" if k % 2 else "#e86a7a", depth=-0.013 - abs(a) * 0.004, parent=root)
        P.piece(f"{name} lotus heart{side}", [P.circle(x, 1.58, 0.035, 14)], "#ffd27a", depth=-0.02, glow=0.4, parent=root)
    return root


# ------------------------------------------------------------------ people

def person(name, parent=None, at=(0, 0), depth=0.0, skin="#7a4a2c", cloth="#f1e2c4", sash=None, crown=False, turban=None, arm="down", scale=1.0, flip=False):
    """A person in profile facing right (left if flip), feet at 0, about 1.7 tall. Arm pivot root['arm']."""
    root = P.group(name, depth=depth, at=at, parent=parent)
    root.scale = (-scale if flip else scale, scale, scale)
    dark = "#" + "".join("%02x" % int(int(skin[i:i + 2], 16) * 0.8) for i in (1, 3, 5))
    farm = P.group(f"{name} farm", depth=0.02, at=(0.02, 1.32), parent=root)
    P.piece(f"{name} farm p", [P.capsule(0, 0, 0.18, -0.48, 0.06, 0.05)], dark, parent=farm)
    P.piece(f"{name} leg1", [P.capsule(-0.06, 0.62, -0.1, 0.04, 0.07, 0.05)], skin, depth=0.01, parent=root)
    P.piece(f"{name} leg2", [P.capsule(0.08, 0.62, 0.14, 0.04, 0.07, 0.05)], skin, depth=0.008, parent=root)
    P.piece(f"{name} dhoti", [P.smooth([(-0.2, 0.98), (0.2, 0.98), (0.27, 0.62), (0.2, 0.44), (0.05, 0.5), (-0.12, 0.42), (-0.24, 0.55)], 6)], cloth, parent=root)
    P.piece(f"{name} pleats", [P.capsule(0.02, 0.95, 0.12, 0.5, 0.025)], cloth, depth=-0.006, parent=root)
    # the dhoti's woven pattern and gold hem; feet and anklets
    shade = "#" + "".join("%02x" % int(int(cloth[i:i + 2], 16) * 0.8) for i in (1, 3, 5))
    for k, (dx, dy) in enumerate([(-0.12, 0.85), (0.0, 0.88), (0.12, 0.85), (-0.15, 0.7), (-0.02, 0.73), (0.11, 0.7), (0.18, 0.6), (-0.13, 0.58)]):
        P.piece(f"{name} dot{k}", [P.circle(dx, dy, 0.018, 10)], shade, depth=-0.007, parent=root)
    P.piece(f"{name} hem", [P.capsule(-0.22, 0.53, 0.25, 0.6, 0.022)], "#e8b04a", depth=-0.008, glow=0.15, parent=root)
    for k, fx in enumerate((-0.1, 0.14)):
        P.piece(f"{name} foot{k}", [P.ellipse(fx + 0.04, 0.025, 0.07, 0.028, 0, 16)], skin, depth=0.006, parent=root)
        P.piece(f"{name} anklet{k}", [P.rect(fx - 0.05, 0.07, 0.1, 0.03)], "#e8b04a", depth=0.004, glow=0.15, parent=root)
    P.piece(f"{name} torso", [P.smooth([(-0.16, 0.95), (0.18, 0.95), (0.2, 1.3), (0.12, 1.42), (-0.1, 1.42), (-0.18, 1.3)], 6)], skin, depth=-0.004, parent=root)
    P.piece(f"{name} neck", [P.rect(-0.02, 1.38, 0.1, 0.12)], skin, depth=-0.003, parent=root)
    head = P.smooth([(-0.1, 1.48), (0.06, 1.46), (0.13, 1.52), (0.16, 1.57), (0.2, 1.58), (0.16, 1.62), (0.17, 1.68), (0.1, 1.74), (-0.02, 1.75), (-0.12, 1.68)], 6)
    P.piece(f"{name} head", [head], skin, depth=-0.006, parent=root)
    # the face in profile: an almond eye, a brow, a gold earring
    P.piece(f"{name} eye", [P.ellipse(0.105, 1.625, 0.024, 0.011, -0.1, 12)], "#1a0f08", depth=-0.009, parent=root)
    P.piece(f"{name} brow", [P.capsule(0.07, 1.655, 0.14, 1.66, 0.007)], "#1a0f08", depth=-0.009, parent=root)
    P.piece(f"{name} earring", [P.circle(-0.01, 1.555, 0.026, 14)], "#e8b04a", depth=-0.009, glow=0.2, parent=root)
    # a beaded necklace, and a shoulder cloth falling behind
    for k in range(7):
        a = math.pi * (1.15 + 0.7 * k / 6)
        P.piece(f"{name} bead{k}", [P.circle(0.02 + math.cos(a) * 0.12, 1.43 + math.sin(a) * 0.09, 0.016, 10)], "#e8b04a", depth=-0.013, glow=0.15, parent=root)
    if sash:
        P.piece(f"{name} shawl", [P.smooth([(-0.17, 1.41), (-0.02, 1.43), (-0.08, 1.32), (-0.24, 1.02), (-0.33, 0.84), (-0.38, 0.88), (-0.3, 1.12)], 6)], sash, depth=0.004, parent=root)
    if sash:
        P.piece(f"{name} sash", [P.capsule(-0.14, 1.36, 0.16, 0.98, 0.045)], sash, depth=-0.01, parent=root)
        P.piece(f"{name} belt", [P.rect(-0.2, 0.92, 0.42, 0.08)], sash, depth=-0.01, parent=root)
    if crown:
        P.piece(f"{name} hair", [P.circle(-0.12, 1.55, 0.1, 24)], "#2b170a", depth=-0.002, parent=root)
        P.piece(f"{name} crown", [[(-0.11, 1.68), (0.15, 1.68), (0.13, 1.8), (0.08, 1.74), (0.02, 1.9), (-0.04, 1.74), (-0.09, 1.8)]], "#e8b04a", depth=-0.012, glow=0.25, parent=root)
        P.piece(f"{name} necklace", [P.capsule(-0.04, 1.4, 0.12, 1.33, 0.025)], "#e8b04a", depth=-0.012, parent=root)
    elif turban:
        P.piece(f"{name} turban", [P.smooth([(-0.13, 1.62), (0.14, 1.66), (0.16, 1.77), (0.02, 1.84), (-0.15, 1.76)], 6)], turban, depth=-0.012, parent=root)
    else:
        P.piece(f"{name} hair", [P.circle(-0.06, 1.66, 0.09, 24)], "#2b170a", depth=-0.002, parent=root)
        P.piece(f"{name} bun", [P.circle(-0.14, 1.62, 0.06, 16)], "#2b170a", depth=-0.002, parent=root)
    arm_root = P.group(f"{name} arm", depth=-0.016, at=(0.04, 1.33), parent=root)
    P.piece(f"{name} upper", [P.capsule(0, 0, 0.02, -0.3, 0.055, 0.045)], skin, parent=arm_root)
    P.piece(f"{name} armlet", [P.rect(-0.055, -0.1, 0.115, 0.035)], "#e8b04a", depth=-0.003, glow=0.15, parent=arm_root)
    fore = P.group(f"{name} fore", depth=-0.002, at=(0.02, -0.3), parent=arm_root)
    P.piece(f"{name} fore p", [P.capsule(0, 0, 0, -0.26, 0.045, 0.04)], skin, parent=fore)
    P.piece(f"{name} bangle", [P.rect(-0.045, -0.22, 0.09, 0.03)], "#e8b04a", depth=-0.003, glow=0.15, parent=fore)
    P.piece(f"{name} hand", [P.circle(0, -0.29, 0.05, 16)], skin, parent=fore)
    poses = {"down": (0.15, 0), "point": (1.35, 0.15), "raise": (2.5, 0.3), "work": (0.9, 1.0)}
    a, b = poses[arm]
    arm_root.rotation_euler = (0, -a, 0)
    fore.rotation_euler = (0, -b, 0)
    root["arm"] = arm_root.name
    root["fore"] = fore.name
    return root


# ------------------------------------------------------------------ elephant (frieze size)

def elephant_outline(x, y, s):
    pts = [(-0.6, 0.45), (-0.55, 0.9), (-0.1, 1.05), (0.35, 0.98), (0.62, 0.82), (0.82, 0.78), (0.9, 0.5), (0.86, 0.12),
           (0.78, 0.1), (0.75, 0.48), (0.6, 0.5), (0.58, 0.0), (0.42, 0.0), (0.4, 0.35), (-0.05, 0.36), (-0.08, 0.0),
           (-0.24, 0.0), (-0.27, 0.36), (-0.4, 0.4), (-0.42, 0.0), (-0.58, 0.0)]
    return [(x + px * s, y + py * s) for px, py in pts]


def lion_outline(x, y, s):
    """A rearing gaja-simha lion over a crouching elephant, as one silhouette (facing right)."""
    pts = [(-0.5, 0), (0.55, 0), (0.6, 0.35), (0.35, 0.42), (0.38, 0.9), (0.52, 1.2), (0.62, 1.55), (0.5, 1.75), (0.32, 1.8),
           (0.22, 1.62), (0.05, 1.5), (-0.1, 1.2), (-0.25, 0.95), (-0.3, 0.6), (-0.42, 0.45), (-0.55, 0.35)]
    return [(x + px * s, y + py * s) for px, py in P.smooth(pts, 4)]


# ------------------------------------------------------------------ the temple

def temple(name, parent=None, at=(0, 0), depth=0.0, tower="full", stone="#8a6444", dark="#5b3d22", light="#b48a5e",
           glow=0.0, scale=1.0, wheels=True, detail=True):
    """Konark from the side, as layered card: plinth, wheels, the jagamohana and its roof, the deul.
    tower: 'full', 'ruin' or 'none'. Tiers (for building it up) are in root['tiers'], bottom first.
    Base at y = 0, about 9 wide; the hall is centred near x = 1.3, the sanctuary to the left."""
    root = P.group(name, depth=depth, at=at, parent=parent)
    root.scale = (scale, scale, scale)
    tiers = []

    def tier(tag, d=0.0):
        t = P.group(f"{name} {tag}", depth=d, parent=root)
        tiers.append(t)
        return t

    # plinth: mouldings, a frieze of elephants cut through to a dark band, and a cornice
    t = tier("plinth")
    P.piece(f"{name} plinth", [P.rect(-4.4, 0, 8.8, 1.0)], stone, glow=glow, parent=t)
    P.piece(f"{name} frieze back", [P.rect(-4.3, 0.12, 8.6, 0.26)], dark, depth=0.01, parent=t)
    if detail:
        P.piece(f"{name} frieze", [P.rect(-4.3, 0.12, 8.6, 0.26)] + [elephant_outline(-4.0 + i * 0.36, 0.15, 0.17) for i in range(24)], light, depth=-0.004, glow=glow, parent=t)
    for k, (yy, h) in enumerate([(0.0, 0.1), (0.42, 0.06), (0.86, 0.14)]):
        P.piece(f"{name} band{k}", [P.rect(-4.5, yy, 9.0, h)], light, depth=-0.008, glow=glow, parent=t)
    for k in range(18):
        P.piece(f"{name} dentil{k}", [P.rect(-4.35 + k * 0.5, 0.52, 0.22, 0.3)], light, depth=-0.006, glow=glow, parent=t)
    if wheels:
        t = tier("wheels", -0.02)
        for i in range(7):
            wheel(f"{name} wheel{i}", 0.4, parent=t, at=(-3.75 + i * 1.25, 0.47), depth=-0.03, colors=(light, "#d8b385", dark), beads=detail, glow=glow)
    # the deul behind, to the left
    if tower != "none":
        t = tier("deul", 0.3)
        if tower == "ruin":
            P.piece(f"{name} ruin", [[(-4.1, 1.0), (-1.1, 1.0), (-1.1, 2.0), (-1.4, 2.4), (-1.75, 2.15), (-2.1, 2.55), (-2.6, 2.2), (-3.0, 2.6), (-3.4, 2.25), (-3.8, 2.45), (-4.1, 2.1)]], dark, glow=glow, parent=t)
            for k in range(6):
                P.piece(f"{name} ruin niche{k}", [P.rect(-3.9 + k * 0.48, 1.25, 0.24, 0.5)], "#2c1b10", depth=-0.004, parent=t)
                if detail:
                    P.piece(f"{name} ruin figure{k}", [woman(-3.78 + k * 0.48, 1.27, 0.26)], stone, depth=-0.006, glow=glow, parent=t)
            for k, yy in enumerate((1.12, 1.82)):
                P.piece(f"{name} ruin band{k}", [P.rect(-4.1, yy, 3.0, 0.06)], stone, depth=-0.005, glow=glow, parent=t)
            P.piece(f"{name} rubble", [P.smooth([(-4.4, 1.0), (-4.0, 1.25), (-3.5, 1.12), (-3.0, 1.3), (-2.4, 1.15), (-1.8, 1.28), (-1.1, 1.1), (-1.0, 1.0)], 4)], stone, depth=-0.03, glow=glow, parent=t)
        else:
            P.piece(f"{name} deul base", [P.rect(-4.1, 1.0, 3.0, 1.6)], dark, glow=glow, parent=t)
            tower_pts = [(-4.0, 2.6)] + [(-4.0 + 1.05 * (u ** 2.4), 2.6 + 4.3 * u) for u in (i / 20 for i in range(1, 21))] + \
                        [(-1.2 - 1.05 * (u ** 2.4), 2.6 + 4.3 * u) for u in (i / 20 for i in range(20, 0, -1))] + [(-1.2, 2.6)]
            P.piece(f"{name} shikhara", [tower_pts], dark, glow=glow, parent=t)
            for k in range(11):
                u = (k + 0.5) / 11
                half = 1.4 - 1.05 * (u ** 2.4)
                P.piece(f"{name} course{k}", [P.rect(-2.6 - half + 0.04, 2.6 + 4.3 * u - 0.03, half * 2 - 0.08, 0.06)], stone, depth=-0.004, glow=glow, parent=t)
            for k in range(4):
                x = -3.5 + k * 0.6
                P.piece(f"{name} rib{k}", [P.rect(x, 2.7, 0.08, 3.4 - abs(k - 1.5) * 0.4)], stone, depth=-0.006, glow=glow, parent=t)
            P.piece(f"{name} amalaka", [P.ellipse(-2.6, 7.0, 0.62, 0.17, 0, 48)], stone, depth=-0.006, glow=glow, parent=t)
            P.piece(f"{name} kalasha", [P.smooth([(-2.75, 7.12), (-2.45, 7.12), (-2.5, 7.4), (-2.6, 7.6), (-2.7, 7.4)], 5)], "#d9a441", depth=-0.008, glow=max(glow, 0.2), parent=t)
    # the jagamohana walls: two storeys of niches, each holding a figure, divided by pilasters
    t = tier("walls")
    niches = []
    for row, ny in enumerate((1.14, 1.88)):
        for k in range(8):
            x = -0.8 + k * 0.55
            if 0.6 < x + 0.13 < 2.0:
                continue  # the doorway
            niches.append((x, ny))
    P.piece(f"{name} walls", [P.rect(-0.9, 1.0, 4.4, 1.6)] + [P.rect(x, y, 0.28, 0.6) for x, y in niches], stone, glow=glow, parent=t)
    P.piece(f"{name} niche backs", [P.rect(-0.8, 1.1, 4.2, 1.42)], "#2c1b10", depth=0.012, parent=t)
    if detail:
        for k, (x, y) in enumerate(niches):
            P.piece(f"{name} figure{k}", [woman(x + 0.15, y + 0.04, 0.3)], light, depth=0.006, glow=glow, parent=t)
            P.piece(f"{name} niche crown{k}", [[(x - 0.03, y + 0.6), (x + 0.31, y + 0.6), (x + 0.22, y + 0.7), (x + 0.14, y + 0.76), (x + 0.06, y + 0.7)]], light, depth=-0.005, glow=glow, parent=t)
        for k in range(9):
            x = -0.86 + k * 0.55
            if 0.6 < x < 2.0:
                continue
            P.piece(f"{name} pilaster{k}", [P.rect(x, 1.04, 0.07, 1.48)] + [P.rect(x + 0.015, 1.1 + j * 0.28, 0.04, 0.08) for j in range(5)], light, depth=-0.004, glow=glow, parent=t)
    P.piece(f"{name} door", [P.rect(0.78, 1.0, 1.04, 1.25)], "#24150c", depth=-0.004, parent=t)
    P.piece(f"{name} door frame", [P.rect(0.66, 1.0, 1.28, 1.38), P.rect(0.78, 1.0, 1.04, 1.25)], "#3d4a3a", depth=-0.008, glow=glow, parent=t)
    P.piece(f"{name} door frame 2", [P.rect(0.72, 1.0, 1.16, 1.31), P.rect(0.78, 1.0, 1.04, 1.25)], "#5a6a54", depth=-0.01, glow=glow, parent=t)
    for k, (yy, h) in enumerate([(2.48, 0.12), (1.78, 0.06), (1.04, 0.06)]):
        P.piece(f"{name} wall band{k}", [P.rect(-0.95, yy, 4.5, h)], light, depth=-0.006, glow=glow, parent=t)
    # three tiers of the pyramidal roof: each slab (pidha) carved along its face under a drip,
    # figures on the terraces between, and great lions leaping out at the ends
    for n_tier, (y0, w0, slabs) in enumerate([(2.6, 4.9, 5), (3.55, 3.9, 4), (4.35, 2.95, 3)]):
        t = tier(f"roof{n_tier}")
        y = y0
        w = w0
        for k in range(slabs):
            P.piece(f"{name} pidha{n_tier}{k}", [[(1.3 - w / 2, y), (1.3 + w / 2, y), (1.3 + w / 2 - 0.08, y + 0.13), (1.3 - w / 2 + 0.08, y + 0.13)]], stone, glow=glow, parent=t)
            P.piece(f"{name} pidha shadow{n_tier}{k}", [P.rect(1.3 - w / 2 + 0.1, y + 0.13, w - 0.2, 0.05)], dark, depth=0.004, parent=t)
            if detail:
                P.piece(f"{name} drip{n_tier}{k}", [P.rect(1.3 - w / 2 - 0.03, y + 0.1, w + 0.06, 0.035)], light, depth=-0.004, glow=glow, parent=t)
                nd = int(w / 0.15)
                P.piece(f"{name} carving{n_tier}{k}", [P.rect(1.3 - w / 2 + 0.12 + j * (w - 0.24) / nd, y + 0.03, 0.06, 0.05) for j in range(nd)], dark, depth=-0.003, parent=t)
            y += 0.18
            w -= 0.18
        if detail and n_tier < 2:
            n = int(w / 0.42)
            for k in range(n):
                x = 1.3 - w / 2 + 0.25 + k * (w - 0.5) / max(1, n - 1)
                P.piece(f"{name} musician{n_tier}{k}", [woman(x, y, 0.17)], light, depth=-0.01, glow=glow, parent=t)
            for side in (-1, 1):
                pts = lion_outline(0, 0, 0.34)
                pts = [(1.3 + side * (w / 2 + 0.05) + side * px, y - 0.12 + py) for px, py in pts]
                P.piece(f"{name} roof lion{n_tier}{side}", [pts], light, depth=-0.012, glow=glow, parent=t)
    t = tier("crown")
    P.piece(f"{name} ghanta", [P.smooth([(0.45, 5.0), (2.15, 5.0), (1.95, 5.25), (1.7, 5.42), (0.9, 5.42), (0.65, 5.25)], 6)], stone, glow=glow, parent=t)
    P.piece(f"{name} neck", [P.rect(1.1, 5.4, 0.4, 0.12)], dark, depth=0.004, parent=t)
    P.piece(f"{name} amalaka", [P.ellipse(1.3, 5.6, 0.55, 0.15, 0, 48)], stone, glow=glow, parent=t)
    for k in range(7):
        P.piece(f"{name} amalaka rib{k}", [P.rect(0.85 + k * 0.15, 5.47, 0.04, 0.26)], dark, depth=-0.004, parent=t)
    P.piece(f"{name} kalasha", [P.smooth([(1.15, 5.74), (1.45, 5.74), (1.42, 5.95), (1.3, 6.15), (1.18, 5.95)], 5)], "#d9a441", depth=-0.004, glow=max(glow, 0.2), parent=t)
    # stairs and the gaja-simha lions at the east end
    t = tier("stairs", -0.05)
    P.piece(f"{name} stairs", [[(3.5, 0), (4.9, 0), (4.9, 0.2), (4.6, 0.2), (4.6, 0.45), (4.3, 0.45), (4.3, 0.7), (4.0, 0.7), (4.0, 1.0), (3.5, 1.0)]], light, glow=glow, parent=t)
    if detail:
        P.piece(f"{name} lion", [lion_outline(4.6, 1.0, 0.42)], stone, depth=-0.02, glow=glow, parent=t)
    root["tiers"] = [x.name for x in tiers]
    return root
