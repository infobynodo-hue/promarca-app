#!/usr/bin/env python3
"""
Probe supplier category IDs via the Vercel probe endpoint.
Usage: python3 probe_categories.py [start] [end] [deployment]
"""
import subprocess, json, sys, time

DEPLOY = sys.argv[3] if len(sys.argv) > 3 else "promarca-9c9ei53ck-infobynodo-8557s-projects.vercel.app"
START = int(sys.argv[1]) if len(sys.argv) > 1 else 21
END = int(sys.argv[2]) if len(sys.argv) > 2 else 50

found = []

for cat_id in range(START, END + 1):
    url = f"https://www.catalogospromocionales.com/Catalogo/Default.aspx?id={cat_id}"
    endpoint = f"/api/supplier/probe?url={url}"

    try:
        result = subprocess.run(
            ["vercel", "curl", endpoint, "--deployment", DEPLOY],
            capture_output=True, text=True, timeout=45
        )
        # Find the JSON in the output
        output = result.stdout + result.stderr
        # Look for JSON object
        start_idx = output.find('{"status"')
        if start_idx == -1:
            start_idx = output.find('{"error"')
        if start_idx == -1:
            print(f"ID {cat_id}: no JSON found")
            continue

        # Find the end of the JSON (simplified - find last })
        json_str = output[start_idx:]
        # Try to parse progressively
        for end_pos in range(len(json_str), 0, -1):
            try:
                data = json.loads(json_str[:end_pos])
                break
            except json.JSONDecodeError:
                continue
        else:
            print(f"ID {cat_id}: JSON parse failed")
            continue

        if data.get('error'):
            print(f"ID {cat_id}: ERROR - {data['error'][:60]}")
            continue

        has_products = data.get('hasProducts', False)
        count = data.get('productCount', 0)
        title = data.get('title', '')

        if has_products and count > 0:
            print(f"ID {cat_id}: [{title}] - {count} products ✓")
            found.append({'id': cat_id, 'title': title, 'count': count})
        else:
            print(f"ID {cat_id}: empty ({title})")

    except subprocess.TimeoutExpired:
        print(f"ID {cat_id}: TIMEOUT")
    except Exception as e:
        print(f"ID {cat_id}: EXCEPTION - {e}")

print("\n=== SUMMARY ===")
print(f"Scanned IDs {START}-{END}, found {len(found)} categories with products:")
for c in found:
    print(f"  ID {c['id']}: {c['title']} ({c['count']} products/page)")
