#!/usr/bin/env python3
"""
Probe specific supplier category IDs and show their product names.
Usage: python3 probe_detail.py [id1] [id2] ...
"""
import subprocess, json, sys, re

DEPLOY = "promarca-2pvmappgc-infobynodo-8557s-projects.vercel.app"
IDS = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else [253, 292, 387, 24, 28]

for cat_id in IDS:
    url = f"https://www.catalogospromocionales.com/Catalogo/Default.aspx?id={cat_id}"
    endpoint = f"/api/supplier/probe?url={url}"

    try:
        result = subprocess.run(
            ["vercel", "curl", endpoint, "--deployment", DEPLOY],
            capture_output=True, text=True, timeout=45
        )
        output = result.stdout + result.stderr

        # Find JSON - look for first { and try to parse from there
        start = output.find('{"status"')
        if start == -1:
            start = output.find('{"error"')
        if start == -1:
            print(f"ID {cat_id}: no JSON")
            continue

        # Try parsing increasing lengths
        data = None
        for end in range(len(output), start, -1):
            try:
                data = json.loads(output[start:end])
                break
            except:
                pass

        if not data:
            print(f"ID {cat_id}: parse failed")
            continue

        title = data.get('title', '?')
        count = data.get('productCount', 0)
        has = data.get('hasProducts', False)
        snippet = data.get('htmlSnippet', '')

        # Try to extract product names and refs from snippet
        names = re.findall(r'<h3>(.*?)</h3>', snippet, re.DOTALL)
        refs = re.findall(r'class="ref[^"]*">(.*?)</p>', snippet, re.DOTALL)

        # Clean them up
        names = [re.sub(r'<[^>]+>', '', n).strip() for n in names[:3]]
        refs = [re.sub(r'<[^>]+>', '', r).strip() for r in refs[:3]]

        # Also try to extract category title from breadcrumb/nav
        bc = re.findall(r'class="[^"]*[Bb]readcrumb[^"]*"[^>]*>(.*?)</[^>]+>', snippet, re.DOTALL)
        bc_text = [re.sub(r'<[^>]+>', '', b).strip() for b in bc[:2]]

        print(f"\nID {cat_id}: title='{title}' | {count} products | bc={bc_text}")
        print(f"  names: {names}")
        print(f"  refs: {refs}")

    except Exception as e:
        print(f"ID {cat_id}: ERROR - {e}")
