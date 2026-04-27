#!/usr/bin/env python3
"""
BATCH 2: Import newly discovered supplier categories into ProMarca.
Based on probe results from IDs 249-399.

Usage: python3 bulk_import_batch2.py [--images] [--deployment URL]
"""
import subprocess, json, sys, time

DEPLOY = "promarca-1fmgrsskc-infobynodo-8557s-projects.vercel.app"
FETCH_IMAGES = "--images" in sys.argv

for i, arg in enumerate(sys.argv):
    if arg == "--deployment" and i + 1 < len(sys.argv):
        DEPLOY = sys.argv[i + 1]

MAPPINGS = [
    # ── TERMOS ────────────────────────────────────────────────────────────────
    # MU-xxx Botilito → Termos (different from Mugs)
    (344, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 344"),
    (345, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 345"),
    (346, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 346"),
    (347, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 347"),
    (351, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 351"),
    (352, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Termo Bullet cat 352"),
    (354, "dc174303-487f-41f3-9fb8-c3757bab0995", "Termos - Botilitos cat 354"),

    # ── MUGS & POSILLOS (additional) ──────────────────────────────────────────
    (348, "32aeb668-2a59-4102-b663-84982421510d", "Mugs - Ceramica cat 348"),
    (349, "32aeb668-2a59-4102-b663-84982421510d", "Mugs - Doble Pared cat 349"),
    (350, "32aeb668-2a59-4102-b663-84982421510d", "Mugs - Vasos cat 350"),
    (353, "32aeb668-2a59-4102-b663-84982421510d", "Mugs - Aro Silicona cat 353"),

    # ── ESPEJOS ───────────────────────────────────────────────────────────────
    (277, "fcef9674-5068-4e15-8ad6-7104a84588b7", "Espejos - CP-315 cat 277"),
    (284, "fcef9674-5068-4e15-8ad6-7104a84588b7", "Espejos - CP-315 cat 284"),

    # ── ANTIBACTERIAL & PASTILLEROS ───────────────────────────────────────────
    (278, "3a0dcf32-4532-44d2-9d08-3b8afac8b5a6", "Antibacterial - Gel cat 278"),
    (282, "3a0dcf32-4532-44d2-9d08-3b8afac8b5a6", "Antibacterial - Pastilleros cat 282"),

    # ── CANGUROS ──────────────────────────────────────────────────────────────
    (327, "2541e79e-d058-421b-8d7f-112221b903a0", "Canguros - VA-1077 cat 327"),

    # ── COOLERS ───────────────────────────────────────────────────────────────
    (331, "96c22d2d-0f21-4cec-8866-137cb782e6d4", "Coolers - Nevera Bag cat 331"),
    (339, "96c22d2d-0f21-4cec-8866-137cb782e6d4", "Coolers - Nevera Spring cat 339"),
    (395, "96c22d2d-0f21-4cec-8866-137cb782e6d4", "Coolers - Silla Nevera cat 395"),

    # ── PORTA COMIDAS ─────────────────────────────────────────────────────────
    (299, "8fc1cd37-620d-484b-bab5-a1a245cbbbad", "Porta comidas - Lonchera cat 299"),
    (304, "8fc1cd37-620d-484b-bab5-a1a245cbbbad", "Porta comidas - Lonchera cat 304"),
    (309, "8fc1cd37-620d-484b-bab5-a1a245cbbbad", "Porta comidas - Lonchera cat 309"),
    (397, "8fc1cd37-620d-484b-bab5-a1a245cbbbad", "Porta comidas - Lonchera cat 397"),
    (398, "8fc1cd37-620d-484b-bab5-a1a245cbbbad", "Porta comidas - Lonchera cat 398"),

    # ── ALCANCÍAS ─────────────────────────────────────────────────────────────
    (386, "d191ecad-4304-457c-9716-efe174d137e3", "Alcancías - cat 386"),

    # ── PAD MOUSE ─────────────────────────────────────────────────────────────
    (359, "26d4db3f-1b02-438b-9e8e-e05a55b194fe", "Pad Mouse - cat 359"),
    (394, "26d4db3f-1b02-438b-9e8e-e05a55b194fe", "Pad Mouse - cat 394"),

    # ── BOLSAS ────────────────────────────────────────────────────────────────
    (325, "85c76419-e583-453b-985b-51788b1e4d11", "Bolsas - Algodón cat 325"),
    (326, "85c76419-e583-453b-985b-51788b1e4d11", "Bolsas - Sporty Bag cat 326"),
    (337, "85c76419-e583-453b-985b-51788b1e4d11", "Bolsas - Sporty RPET cat 337"),
    (338, "85c76419-e583-453b-985b-51788b1e4d11", "Bolsas - Yute cat 338"),

    # ── PORTADOCUMENTOS ───────────────────────────────────────────────────────
    (335, "305dfc70-29f9-44d3-8d3c-9044bad9280f", "Portadocumentos - cat 335"),
    (343, "305dfc70-29f9-44d3-8d3c-9044bad9280f", "Portadocumentos - Portatarjetas cat 343"),
    (364, "305dfc70-29f9-44d3-8d3c-9044bad9280f", "Portadocumentos - ARC cat 364"),

    # ── MALETAS DE VIAJE ──────────────────────────────────────────────────────
    (334, "b964ceb9-0478-4734-a955-41c061565281", "Maletas - Maletín Master Ocean cat 334"),

    # ── ORGANIZADOR DE VIAJE ──────────────────────────────────────────────────
    (332, "5157efed-4c01-4d7a-bc15-95fb8678fed5", "Organizador Viaje - Multiusos cat 332"),
    (249, "5157efed-4c01-4d7a-bc15-95fb8678fed5", "Organizador Viaje - Set Viaje cat 249"),

    # ── RESALTADORES ──────────────────────────────────────────────────────────
    (254, "127d637b-97b9-425b-96a2-15076ff1f352", "Resaltadores - ADVA cat 254"),
    (362, "127d637b-97b9-425b-96a2-15076ff1f352", "Resaltadores - Estuche cat 362"),

    # ── TOALLAS ───────────────────────────────────────────────────────────────
    (274, "36051b11-4112-4163-8324-81c47e7301ab", "Toallas - Comprimidas cat 274"),
    (276, "36051b11-4112-4163-8324-81c47e7301ab", "Toallas - Comprimidas cat 276"),
    (303, "36051b11-4112-4163-8324-81c47e7301ab", "Toallas - Cobija Fleece cat 303"),

    # ── ESCOLAR ───────────────────────────────────────────────────────────────
    (266, "459b34b4-8546-4e09-9bb4-448b837740c5", "Escolar - Calculadoras cat 266"),
    (268, "459b34b4-8546-4e09-9bb4-448b837740c5", "Escolar - Calculadoras cat 268"),
    (356, "459b34b4-8546-4e09-9bb4-448b837740c5", "Escolar - Set Colores cat 356"),
    (389, "459b34b4-8546-4e09-9bb4-448b837740c5", "Escolar - Set Colores cat 389"),

    # ── CALENDARIOS ───────────────────────────────────────────────────────────
    (393, "e99f1dc8-bb81-4453-9656-f4bcdb4f7f74", "Calendarios - Almanaque cat 393"),

    # ── ABANICOS ──────────────────────────────────────────────────────────────
    (396, "9445926e-4915-4c7c-8531-49cb2b6e06d0", "Abanicos - cat 396"),

    # ── BOTONES Y PINES / ESCARAPELAS ─────────────────────────────────────────
    (391, "7aa85ee7-666a-40e2-b1ae-72088a785676", "Botones y Pines - cat 391"),

    # ── ACCESORIOS CELULAR ────────────────────────────────────────────────────
    (264, "47a15ea6-4166-4f50-a659-05f0dbd61337", "Accesorios Celular - Estuches cat 264"),

    # ── PILAS RECARGABLES ─────────────────────────────────────────────────────
    (376, "d997a825-0b44-4748-b45e-0478d87ea318", "Pilas Recargables - Power Bank cat 376"),

    # ── SPEAKER ───────────────────────────────────────────────────────────────
    (380, "7cf73b41-3753-404e-80a6-b7cb526cf973", "Speaker - Bluetooth cat 380"),

    # ── ACCESORIOS COMPUTADOR ────────────────────────────────────────────────
    (373, "9a48804a-88b0-4ad1-9a9a-605dd2dd2788", "Accesorios PC - USB Einstein cat 373"),
    (377, "9a48804a-88b0-4ad1-9a9a-605dd2dd2788", "Accesorios PC - Cables cat 377"),
    (382, "9a48804a-88b0-4ad1-9a9a-605dd2dd2788", "Accesorios PC - Cables cat 382"),

    # ── AUDÍFONOS (additional) ───────────────────────────────────────────────
    (374, "7c10d8bf-da43-448c-a746-813d905312e9", "Audífonos - Bowie cat 374"),
    (375, "7c10d8bf-da43-448c-a746-813d905312e9", "Audífonos - Bowie cat 375"),
    (250, "7c10d8bf-da43-448c-a746-813d905312e9", "Audífonos - Boompods cat 250"),

    # ── USB (additional) ─────────────────────────────────────────────────────
    (381, "c0bb432e-0403-4540-b025-53c6e83c3cb0", "USB - Credit Card cat 381"),
    (383, "c0bb432e-0403-4540-b025-53c6e83c3cb0", "USB - Boligrafo cat 383"),
    (384, "c0bb432e-0403-4540-b025-53c6e83c3cb0", "USB - Carabinero cat 384"),
    (385, "c0bb432e-0403-4540-b025-53c6e83c3cb0", "USB - Credit Card cat 385"),

    # ── LLAVEROS (additional) ────────────────────────────────────────────────
    (314, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Linterna cat 314"),
    (317, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Destapador cat 317"),
    (318, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Linterna cat 318"),
    (319, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Carabinero cat 319"),
    (320, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Linterna cat 320"),
    (321, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Mini Pito cat 321"),
    (322, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Multiusos cat 322"),
    (323, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Linterna cat 323"),
    (324, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Multiusos cat 324"),
    (340, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - ML cat 340"),
    (341, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Gancho cat 341"),
    (342, "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros - Clip cat 342"),

    # ── RELOJES (additional) ─────────────────────────────────────────────────
    (370, "f64c4848-528e-4bc6-ae17-b7306921ec4b", "Relojes - Mecanismo cat 370"),
    (371, "f64c4848-528e-4bc6-ae17-b7306921ec4b", "Relojes - Pared cat 371"),
    (372, "f64c4848-528e-4bc6-ae17-b7306921ec4b", "Relojes - Mecanismo cat 372"),

    # ── SOMBRILLAS (additional) ──────────────────────────────────────────────
    (290, "b63f0ac5-0c44-4f55-916b-01527107d068", "Sombrillas - Golf cat 290"),
    (367, "b63f0ac5-0c44-4f55-916b-01527107d068", "Sombrillas - Freerain cat 367"),
    (368, "b63f0ac5-0c44-4f55-916b-01527107d068", "Sombrillas - Osmond cat 368"),
    (369, "b63f0ac5-0c44-4f55-916b-01527107d068", "Sombrillas - Halley cat 369"),

    # ── HERRAMIENTAS (additional) ────────────────────────────────────────────
    (293, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Set cat 293"),
    (294, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Candado cat 294"),
    (295, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Saxon cat 295"),
    (296, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Metro cat 296"),
    (297, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Destornilladores cat 297"),
    (298, "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas - Saxon cat 298"),

    # ── TEXTILES (additional) ────────────────────────────────────────────────
    (273, "966d01be-4650-46f8-b578-70ef5181f3f9", "Textiles - Chaqueta cat 273"),
    (366, "966d01be-4650-46f8-b578-70ef5181f3f9", "Textiles - Chaqueta PVC cat 366"),

    # ── AGENDAS (additional) ─────────────────────────────────────────────────
    (315, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Set Escritorio cat 315"),
    (355, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Set Escritorio cat 355"),
    (357, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Libretas cat 357"),
    (358, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Memo Stick cat 358"),
    (360, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Carpeta Folder cat 360"),
    (361, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Set Escritorio cat 361"),
    (363, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Libretas cat 363"),
    (365, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Carpeta Folder cat 365"),
    (390, "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas - Organizador Escritorio cat 390"),

    # ── LAPICEROS (additional from probe) ────────────────────────────────────
    (256, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Set Escritorio cat 256"),
    (257, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Set Escritorio cat 257"),
    (259, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Stylus cat 259"),
    (260, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Kent/Smith cat 260"),
    (261, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Stylus cat 261"),
    (262, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Sets cat 262"),
    (263, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Talbot cat 263"),
    (258, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Aldrich cat 258"),
    (399, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Smith/Billy cat 399"),

    # ── BAR & VINO (additional) ──────────────────────────────────────────────
    (265, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Licorera cat 265"),
    (301, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Set Vino cat 301"),
    (302, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Set Vino cat 302"),
    (305, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Destapador cat 305"),
    (307, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Set BBQ cat 307"),
    (308, "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar&Vino - Set Queso cat 308"),

    # ── BELLEZA (additional) ─────────────────────────────────────────────────
    (280, "0f3154cb-1ba7-4bed-91fb-b5fa53ec45a2", "Belleza - Masajeador cat 280"),
    (300, "0f3154cb-1ba7-4bed-91fb-b5fa53ec45a2", "Belleza - Molde Silicona cat 300"),
    (333, "0f3154cb-1ba7-4bed-91fb-b5fa53ec45a2", "Belleza - Molde Silicona cat 333"),
    (392, "0f3154cb-1ba7-4bed-91fb-b5fa53ec45a2", "Belleza - Gafas cat 392"),

    # ── TULAS (additional bags) ──────────────────────────────────────────────
    (328, "b539c84b-fa20-423f-afb7-b4061dd057f6", "Tulas - Morral Backpack cat 328"),
    (329, "b539c84b-fa20-423f-afb7-b4061dd057f6", "Tulas - Morral Bobby cat 329"),
    (330, "b539c84b-fa20-423f-afb7-b4061dd057f6", "Tulas - Morral Elegant cat 330"),
    (336, "b539c84b-fa20-423f-afb7-b4061dd057f6", "Tulas - Morral cat 336"),

    # ── GORRAS (additional) ──────────────────────────────────────────────────
    (275, "b43bf08e-eba2-4acb-8c2f-17a9a4d5cd57", "Gorras - Trucker cat 275"),
]

# ──────────────────────────────────────────────────────────────────────────────

def call_bulk_import(supplier_cat_id, promarca_cat_id, page=1, fetch_images=False):
    payload = json.dumps({
        "supplierCatId": supplier_cat_id,
        "promarcaCategoryId": promarca_cat_id,
        "fetchImages": fetch_images,
        "page": page
    })
    try:
        result = subprocess.run(
            ["vercel", "curl", "/api/supplier/bulk-import",
             "--deployment", DEPLOY,
             "--", "--request", "POST",
             "--header", "Content-Type: application/json",
             "--data", payload],
            capture_output=True, text=True, timeout=320
        )
        output = result.stdout + result.stderr
        start = output.find('{"page"')
        if start == -1:
            start = output.find('{"error"')
        if start == -1:
            return {"error": f"no JSON: {output[-200:]}"}
        for end in range(len(output), start, -1):
            try:
                return json.loads(output[start:end])
            except:
                pass
        return {"error": "JSON parse failed"}
    except subprocess.TimeoutExpired:
        return {"error": "TIMEOUT"}
    except Exception as e:
        return {"error": str(e)}

# ──────────────────────────────────────────────────────────────────────────────

total_created = 0
total_skipped = 0
errors = []

print(f"BATCH 2 | deployment={DEPLOY} | mappings={len(MAPPINGS)}\n")

for sup_id, prm_id, desc in MAPPINGS:
    print(f"\n{'='*55}")
    print(f"→ {desc}  (supplier {sup_id})")

    page = 1
    cat_created = 0
    cat_skipped = 0
    max_pages = 30

    while page <= max_pages:
        print(f"  p{page}...", end=" ", flush=True)
        data = call_bulk_import(sup_id, prm_id, page, FETCH_IMAGES)

        if "error" in data:
            print(f"ERROR: {data['error'][:100]}")
            errors.append(f"{desc}: {data['error'][:100]}")
            break

        created = data.get("created", 0)
        skipped = data.get("skipped", 0)
        total_pages = data.get("totalPages", 1)
        next_page = data.get("nextPage")

        cat_created += created
        cat_skipped += skipped

        print(f"+{created} skip={skipped} [{page}/{total_pages}]")

        if not next_page:
            break
        page = next_page
        time.sleep(0.3)

    total_created += cat_created
    total_skipped += cat_skipped
    print(f"  ✓ {cat_created} created, {cat_skipped} skipped")

print(f"\n{'='*55}")
print(f"BATCH 2 DONE: {total_created} created | {total_skipped} skipped")
if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors: print(f"  - {e}")
