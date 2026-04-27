#!/usr/bin/env python3
"""
Probe supplier categories and extract first few product names.
Usage: python3 probe_names.py [id1] [id2] ...
"""
import subprocess, json, sys, re

DEPLOY = "promarca-1fmgrsskc-infobynodo-8557s-projects.vercel.app"
IDS = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else list(range(249, 310))

for cat_id in IDS:
    url = f"https://www.catalogospromocionales.com/Catalogo/Default.aspx?id={cat_id}"
    endpoint = f"/api/supplier/probe?url={url}"

    try:
        result = subprocess.run(
            ["vercel", "curl", endpoint, "--deployment", DEPLOY],
            capture_output=True, text=True, timeout=45
        )
        output = result.stdout + result.stderr
        start = output.find('{"status"')
        if start == -1:
            continue
        data = None
        for end in range(len(output), start, -1):
            try:
                data = json.loads(output[start:end])
                break
            except:
                pass
        if not data or not data.get('hasProducts'):
            continue

        title = data.get('title', '')
        count = data.get('productCount', 0)
        pages = data.get('totalPages', 1)
        names = data.get('productNames', [])
        refs = data.get('productRefs', [])

        # HTML decode names
        def decode(s):
            return s.replace('&Uacute;', 'Ú').replace('&uacute;', 'ú')\
                    .replace('&aacute;', 'á').replace('&Aacute;', 'Á')\
                    .replace('&eacute;', 'é').replace('&iacute;', 'í')\
                    .replace('&oacute;', 'ó').replace('&ntilde;', 'ñ')\
                    .replace('&nbsp;', ' ').replace('&amp;', '&')\
                    .replace('&#39;', "'")

        clean_names = [decode(n)[:45] for n in names if n.strip() and n != '&nbsp;']
        clean_refs = [r[:20] for r in refs]

        if count > 0 and clean_names:
            print(f"ID {cat_id:3d} [{title:20s}] {count:2d}/p {pages:2d}pp | {clean_refs[:2]} | {clean_names[:2]}")

    except Exception as e:
        pass
