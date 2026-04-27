#!/usr/bin/env python3
"""
Fetch images for ALL products that currently have no images.
Calls /api/supplier/fetch-images in batches of 15 until all products are covered.

Usage: python3 fetch_all_images.py [--deployment URL]
"""
import subprocess, json, sys, time

DEPLOY = "promarca-1fmgrsskc-infobynodo-8557s-projects.vercel.app"
BATCH_SIZE = 15  # conservative to stay within Vercel timeout

for i, arg in enumerate(sys.argv):
    if arg == "--deployment" and i + 1 < len(sys.argv):
        DEPLOY = sys.argv[i + 1]


def call_fetch_images(offset=0, limit=15):
    payload = json.dumps({"batch": True, "offset": offset, "limit": limit})
    try:
        result = subprocess.run(
            ["vercel", "curl", "/api/supplier/fetch-images",
             "--deployment", DEPLOY,
             "--", "--request", "POST",
             "--header", "Content-Type: application/json",
             "--data", payload],
            capture_output=True, text=True, timeout=320
        )
        output = result.stdout + result.stderr
        start = output.find('{"processed"')
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

total_with_images = 0
total_no_images   = 0
total_processed   = 0
errors = []
offset = 0
grand_total = None

print(f"Fetch images | deployment={DEPLOY}")
print(f"Batch size={BATCH_SIZE}\n")

while True:
    print(f"  offset={offset}...", end=" ", flush=True)
    data = call_fetch_images(offset=offset, limit=BATCH_SIZE)

    if "error" in data:
        msg = data["error"][:150]
        print(f"ERROR: {msg}")
        errors.append(f"offset={offset}: {msg}")
        # Try to advance anyway to not get stuck
        offset += BATCH_SIZE
        if len(errors) >= 5:
            print("Too many errors, stopping.")
            break
        time.sleep(2)
        continue

    processed   = data.get("processed", 0)
    with_images = data.get("withImages", 0)
    no_images   = data.get("noImages", 0)
    total       = data.get("total", 0)
    next_offset = data.get("nextOffset")

    if grand_total is None:
        grand_total = total
        print(f"[total sin imágenes: {grand_total}]")

    total_with_images += with_images
    total_no_images   += no_images
    total_processed   += processed

    print(f"+{with_images} con img | {no_images} sin img | [{total_processed}/{grand_total}]")

    # Print per-product details for transparency
    for d in data.get("details", []):
        ref    = d.get("reference", "?")
        status = "✅" if d.get("found") else "❌"
        n      = d.get("imagesCount", 0)
        reason = d.get("failReason", "")
        if d.get("found"):
            print(f"    {status} {ref} ({n} img)")
        else:
            print(f"    {status} {ref} — {reason}")

    if not next_offset:
        break

    offset = next_offset
    time.sleep(1)  # brief pause between batches

print(f"\n{'='*55}")
print(f"ALL DONE: {total_with_images} con imágenes | {total_no_images} sin imágenes | {total_processed} procesados")
if errors:
    print(f"\nErrores ({len(errors)}):")
    for e in errors:
        print(f"  - {e}")
