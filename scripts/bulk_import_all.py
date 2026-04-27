#!/usr/bin/env python3
"""
Run bulk import for all ProMarca categories using known supplier category IDs.
Handles pagination automatically.

Usage: python3 bulk_import_all.py [--images] [--deployment URL]
"""
import subprocess, json, sys, time

DEPLOY = "promarca-2pvmappgc-infobynodo-8557s-projects.vercel.app"
FETCH_IMAGES = "--images" in sys.argv

for i, arg in enumerate(sys.argv):
    if arg == "--deployment" and i + 1 < len(sys.argv):
        DEPLOY = sys.argv[i + 1]

# ──────────────────────────────────────────────────────────────────────────────
# MAPPING: (supplierCatId, promarcaCategoryId, description)
# One mapping per supplier category to avoid duplicate skips.
# ──────────────────────────────────────────────────────────────────────────────
MAPPINGS = [
    # Lapiceros / Boligrafos (3 supplier subcategories all → Lapiceros)
    (9,   "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Boligrafos"),
    (253, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - cat 253"),
    (255, "8dce75f3-0fad-4c86-b4e8-2c9763634364", "Lapiceros - Ecologicos"),

    # Mugs (cat 23 has both mugs and termos → send to Mugs)
    (23,  "32aeb668-2a59-4102-b663-84982421510d", "Mugs & Posillos"),

    # Gorras
    (292, "b43bf08e-eba2-4acb-8c2f-17a9a4d5cd57", "Gorras"),

    # Bolsos & Tulas (Maletines on supplier → Bolsos)
    (107, "df00ec4c-4884-47de-b25f-94c2f371ccc7", "Bolsos"),

    # Sombrillas / Paraguas
    (25,  "b63f0ac5-0c44-4f55-916b-01527107d068", "Sombrillas"),

    # USB / Memorias
    (31,  "c0bb432e-0403-4540-b025-53c6e83c3cb0", "USB"),

    # Textiles / Confecciones
    (12,  "966d01be-4650-46f8-b578-70ef5181f3f9", "Textiles"),

    # Agendas (Oficina on supplier includes cuadernos, agendas, etc.)
    (24,  "9d82032b-50d5-421e-9e68-efb5f54849f0", "Agendas"),

    # Antiestrés (2 supplier subcategories)
    (252, "40ce92a2-7f2c-43f6-9ac7-c7434e876372", "Antiestrés - cat 252"),
    (387, "40ce92a2-7f2c-43f6-9ac7-c7434e876372", "Antiestrés - cat 387"),

    # Relojes
    (27,  "f64c4848-528e-4bc6-ae17-b7306921ec4b", "Relojes"),

    # Llaveros
    (19,  "c24cacb1-b5ab-4706-bd0f-d46da976cf7a", "Llaveros"),

    # Herramientas
    (15,  "255dc09a-4f51-49e3-9807-87647bdc93bd", "Herramientas"),

    # Juegos & Entretenimiento
    (18,  "2b46dad7-bf89-41bc-aa06-088c0a5679c1", "Juegos & Entretenimiento"),

    # Belleza (Cuidado Personal on supplier)
    (13,  "0f3154cb-1ba7-4bed-91fb-b5fa53ec45a2", "Belleza"),

    # Tecnología → Audífonos (main tech items)
    (112, "7c10d8bf-da43-448c-a746-813d905312e9", "Audífonos / Tecnología"),

    # Hogar → Bar & Vino (home goods)
    (16,  "d79a2438-cc40-45ed-8b1c-0cd20fd26909", "Bar & Vino / Hogar"),

    # Variedades → Kits Corporativos (mixed general category)
    (28,  "6ffd57ea-57ad-4690-9dcb-fe797844831e", "Kits Corporativos / Variedades"),

    # Producción Nacional → Kits Corporativos
    (108, "6ffd57ea-57ad-4690-9dcb-fe797844831e", "Kits Corporativos / Producción Nacional"),
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
            return {"error": f"no JSON: {output[-300:]}"}
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
total_images = 0
errors = []

print(f"Bulk import | deployment={DEPLOY}")
print(f"fetch_images={FETCH_IMAGES} | mappings={len(MAPPINGS)}\n")

for sup_id, prm_id, desc in MAPPINGS:
    print(f"\n{'='*55}")
    print(f"→ {desc}  (supplier {sup_id} → {prm_id[:8]}...)")

    page = 1
    cat_created = 0
    cat_skipped = 0
    cat_images = 0
    max_pages = 50  # safety limit

    while page <= max_pages:
        print(f"  p{page}...", end=" ", flush=True)
        data = call_bulk_import(sup_id, prm_id, page, FETCH_IMAGES)

        if "error" in data:
            print(f"ERROR: {data['error'][:120]}")
            errors.append(f"{desc} p{page}: {data['error'][:120]}")
            break

        created = data.get("created", 0)
        skipped = data.get("skipped", 0)
        images = data.get("images", 0)
        total_pages = data.get("totalPages", 1)
        next_page = data.get("nextPage")

        cat_created += created
        cat_skipped += skipped
        cat_images += images

        print(f"+{created} skip={skipped} img={images} [{page}/{total_pages}]")

        if not next_page:
            break
        page = next_page
        time.sleep(0.5)

    total_created += cat_created
    total_skipped += cat_skipped
    total_images += cat_images
    print(f"  ✓ {cat_created} created, {cat_skipped} skipped, {cat_images} images")

print(f"\n{'='*55}")
print(f"ALL DONE: {total_created} created | {total_skipped} skipped | {total_images} images")
if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors: print(f"  - {e}")
