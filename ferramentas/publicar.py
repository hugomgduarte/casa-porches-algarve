#!/usr/bin/env python3
"""
Casa Porches — publica no GitHub Pages os ficheiros do site que mudaram.

Uso:
    python3 ferramentas/publicar.py            (lê o token de ferramentas/github_token.txt ou da variável GITHUB_TOKEN)
    python3 ferramentas/publicar.py --apagar textos.js eventos.js   (remove ficheiros antigos do site)

O token é um "fine-grained personal access token" do GitHub com acesso APENAS ao
repositório casa-porches-algarve e permissão Contents: Read and write.
Nunca o envie por email nem o coloque no repositório.
"""
import base64, hashlib, json, os, sys, time, urllib.request, urllib.error

REPO = "hugomgduarte/casa-porches-algarve"
BRANCH = "master"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["data/site.json", "guia.css", "guia.js", "explorar.html", "guia.html", "index.html", "style.css", "script.js", "wifi-qr.svg", "data/site.json",
         "Conteudos_Site_Casa_Porches.xlsx", "ferramentas/build_site.py", "ferramentas/publicar.py"]


def token():
    t = os.environ.get("GITHUB_TOKEN")
    p = os.path.join(ROOT, "ferramentas", "github_token.txt")
    if not t and os.path.exists(p):
        t = open(p).read().strip()
    if not t:
        sys.exit("Falta o token do GitHub (ferramentas/github_token.txt ou variável GITHUB_TOKEN)")
    return t


T = token()


def api(method, path, data=None):
    req = urllib.request.Request("https://api.github.com/repos/" + REPO + path, method=method,
                                 data=json.dumps(data).encode() if data else None,
                                 headers={"Authorization": "Bearer " + T, "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        sys.exit(f"GitHub respondeu {e.code} em {method} {path}: {e.read()[:300]!r}")


def git_sha(b):
    return hashlib.sha1(b"blob %d\0" % len(b) + b).hexdigest()


def main():
    remote = {}
    tree = api("GET", f"/git/trees/{BRANCH}?recursive=1")
    for it in tree.get("tree", []):
        remote[it["path"]] = it["sha"]

    if "--apagar" in sys.argv:
        for f in sys.argv[sys.argv.index("--apagar") + 1:]:
            if f in remote:
                api("DELETE", "/contents/" + f, {"message": f"Remove {f} (substituído por data/site.json)", "sha": remote[f], "branch": BRANCH})
                print("apagado:", f)
        return

    changed = 0
    files = list(dict.fromkeys(FILES))
    for d, _, fs in os.walk(os.path.join(ROOT, "images")):
        for n in fs:
            if not n.startswith("_"):
                files.append(os.path.relpath(os.path.join(d, n), ROOT).replace(os.sep, "/"))
    for f in files:
        p = os.path.join(ROOT, f)
        if not os.path.exists(p):
            continue
        b = open(p, "rb").read()
        if remote.get(f) == git_sha(b):
            continue
        d = {"message": f"Atualiza {f}", "content": base64.b64encode(b).decode(), "branch": BRANCH}
        if f in remote:
            d["sha"] = remote[f]
        api("PUT", "/contents/" + f, d)
        print("publicado:", f)
        changed += 1
    if not changed:
        print("Nada mudou — o site já está atualizado.")
        return
    for _ in range(9):
        time.sleep(15)
        b = api("GET", "/pages/builds/latest") or {}
        if b.get("status") == "built":
            print("Site publicado: https://hugomgduarte.github.io/casa-porches-algarve/")
            return
    print("Enviado. O GitHub ainda está a publicar — deve ficar visível em 1–2 minutos.")


if __name__ == "__main__":
    main()
