#!/usr/bin/env python3
"""
Casa Porches — converte o Excel de conteúdos no ficheiro de dados do site.

Uso:
    python3 ferramentas/build_site.py  [caminho/para/Conteudos_Site_Casa_Porches.xlsx]

Gera:
    data/site.json   (lido pelo guia.html e pelo index.html)
    wifi-qr.svg      (QR Code do Wi-Fi, se a biblioteca 'segno' estiver instalada)

Se houver erros (ex.: datas inválidas, categorias desconhecidas), o script
mostra-os e NÃO grava nada, para não estragar o site.
"""
import json, os, sys, datetime

try:
    import openpyxl
except ImportError:
    sys.exit("Falta a biblioteca openpyxl:  pip install openpyxl")

LANGS = ["pt", "en", "es", "fr", "de", "it"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "Conteudos_Site_Casa_Porches.xlsx")

errors, warnings = [], []
REST_ICON = {"michelin": "⭐", "fine": "🥂", "wine": "🍷", "sea": "🐟", "trad": "🍲", "intl": "🌍", "cafe": "☕"}
EV_ICON = {"cities": "🏘️", "outdoor": "🥾", "events": "🎉", "water": "🛝", "nature": "🌿", "sea": "⛵", "indoor": "🏊", "markets": "🧺"}


def rows(ws):
    """Linhas da folha como dicionários (cabeçalho na linha 1). Ignora linhas vazias."""
    it = ws.iter_rows(values_only=True)
    head = [str(h).strip() if h is not None else "" for h in next(it)]
    out = []
    for n, r in enumerate(it, start=2):
        d = {head[i]: r[i] for i in range(min(len(head), len(r))) if head[i]}
        if all(v is None or str(v).strip() == "" for v in d.values()):
            continue
        d["_linha"] = n
        out.append(d)
    return out


def s(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def date(v, where):
    if v in (None, ""):
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    t = s(v)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.datetime.strptime(t, fmt).date().isoformat()
        except ValueError:
            pass
    errors.append(f"{where}: data inválida '{t}' (use dd/mm/aaaa)")
    return None


def langs(r, prefix, where, required=True):
    d = {l: s(r.get(f"{prefix}_{l}")) for l in LANGS}
    if required and not d["pt"]:
        errors.append(f"{where}: falta o texto em português ({prefix}_pt)")
    for l in LANGS:
        if d["pt"] and not d[l]:
            warnings.append(f"{where}: falta tradução {prefix}_{l} — usa-se o inglês/português")
            d[l] = d["en"] or d["pt"]
    return d if any(d.values()) else None


def img(r, default, where):
    """Imagem do cartão: a da coluna 'imagem' ou, se vazia, a ilustração da categoria."""
    v = s(r.get("foto") or r.get("imagem")).replace("\\", "/")
    if not v:
        return default
    if v.startswith("http://") or v.startswith("https://"):
        warnings.append(f"{where}: imagem externa ({v}) — confirme que tem autorização para a usar")
        return v
    if not os.path.exists(os.path.join(ROOT, v)):
        errors.append(f"{where}: a imagem '{v}' não existe na pasta do site")
    return v


def coords(r, where):
    lat, lng = r.get("lat"), r.get("lng")
    if lat in (None, "") and lng in (None, ""):
        return {}
    try:
        lat, lng = float(str(lat).replace(",", ".")), float(str(lng).replace(",", "."))
    except ValueError:
        errors.append(f"{where}: coordenadas inválidas ({lat}, {lng})")
        return {}
    if not (36.9 < lat < 37.5 and -9.1 < lng < -7.3):
        errors.append(f"{where}: coordenadas fora do Algarve ({lat}, {lng}) — trocou lat e lng?")
        return {}
    return {"lat": lat, "lng": lng}


def set_path(obj, path, value):
    parts = path.split(".")
    for i, p in enumerate(parts[:-1]):
        nxt = parts[i + 1]
        if p not in obj:
            obj[p] = [] if nxt.isdigit() else {}
        obj = obj[p]
    last = parts[-1]
    if isinstance(obj, list):
        idx = int(last) - 1
        while len(obj) <= idx:
            obj.append("")
        obj[idx] = value
    else:
        obj[last] = value


def main():
    if not os.path.exists(XLSX):
        sys.exit(f"Não encontro o Excel: {XLSX}")
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    need = ["Casa", "Textos", "Localidades", "Mapa", "Restaurantes", "Eventos", "Sessoes", "Pagina_Principal"]
    for n in need:
        if n not in wb.sheetnames:
            sys.exit(f"Falta a folha '{n}' no Excel")

    out = {"LANGS": [], "WIFI": {}, "TXT": {l: {} for l in LANGS}, "REST_CATS": {}, "REST_UI": {},
           "EV_CATS": {}, "EV_TAGS": {}, "EV_UI": {}, "TOWNS": {}, "PLACES": [], "RESTAURANTS": [],
           "EVENTS": [], "SITE_LANGS": LANGS, "SITE_ROWS": []}

    # ---- Casa (Wi-Fi) ----
    casa = {s(r.get("campo")): s(r.get("valor")) for r in rows(wb["Casa"])}
    out["WIFI"] = {"ssid": casa.get("wifi_rede", ""), "password": casa.get("wifi_palavra_passe", "")}
    out["CASA"] = {k: v for k, v in casa.items() if not k.startswith("wifi_")}
    if not out["WIFI"]["ssid"]:
        errors.append("Casa: falta wifi_rede")
    out["LANGS"] = [{"code": l, "label": l.upper(), "name": n} for l, n in
                    zip(LANGS, ["Português", "English", "Español", "Français", "Deutsch", "Italiano"])]

    # ---- Textos ----
    groups = {"rest.cat.": "REST_CATS", "rest.ui.": "REST_UI", "ev.cat.": "EV_CATS", "ev.tag.": "EV_TAGS", "ev.ui.": "EV_UI"}
    for r in rows(wb["Textos"]):
        key = s(r.get("chave"))
        if not key:
            continue
        where = f"Textos linha {r['_linha']} ({key})"
        vals = {l: s(r.get(l)) for l in LANGS}
        if not vals["pt"]:
            errors.append(f"{where}: falta o português")
        for l in LANGS:
            if not vals[l]:
                warnings.append(f"{where}: falta {l}")
                vals[l] = vals["en"] or vals["pt"]
        g = next((g for g in groups if key.startswith(g)), None)
        if g:
            out[groups[g]][key[len(g):]] = vals
        else:
            for l in LANGS:
                set_path(out["TXT"][l], key, vals[l])

    # ---- Localidades ----
    for r in rows(wb["Localidades"]):
        k = s(r.get("chave"))
        km, mn = r.get("km"), r.get("minutos")
        out["TOWNS"][k] = {"name": s(r.get("nome")), "km": None if km in (None, "") else float(km) if not float(km).is_integer() else int(km),
                           "min": None if mn in (None, "") else int(mn)}

    # ---- Mapa (praias, locais, pins) ----
    for r in rows(wb["Mapa"]):
        where = f"Mapa linha {r['_linha']}"
        lat, lng = r.get("lat"), r.get("lng")
        out["PLACES"].append({"cat": s(r.get("categoria")), "list": s(r.get("seccao")), "name": s(r.get("nome")),
                              "dist": s(r.get("distancia")), "lat": None if lat in (None, "") else float(lat),
                              "lng": None if lng in (None, "") else float(lng), "q": s(r.get("pesquisa_maps")) or s(r.get("nome")),
                              "img": img(r, None, where),
                              "d": langs(r, "desc", where)})

    # ---- Restaurantes ----
    rc = set(out["REST_CATS"]) - {"near"}
    for r in rows(wb["Restaurantes"]):
        where = f"Restaurantes linha {r['_linha']} ({s(r.get('nome'))})"
        cat = s(r.get("categoria"))
        if cat not in rc:
            errors.append(f"{where}: categoria '{cat}' desconhecida (use: {', '.join(sorted(rc))})")
        if s(r.get("mostrar")).lower() in ("não", "nao", "n", "no"):
            continue
        out["RESTAURANTS"].append({**coords(r, where), "cat": cat, "name": s(r.get("nome")), "loc": s(r.get("localidade")),
                                   "price": s(r.get("preco")), "near": s(r.get("perto_de_casa")).lower() in ("sim", "s", "yes", "x"),
                                   "q": s(r.get("pesquisa_maps")) or (s(r.get("nome")) + " " + s(r.get("localidade"))),
                                   "img": img(r, None, where), "icon": s(r.get("icone")) or REST_ICON.get(cat, "🍽️"),
                                   "d": langs(r, "desc", where)})

    # ---- Eventos ----
    ec = set(out["EV_CATS"]) - {"upcoming"}
    tags = set(out["EV_TAGS"])
    sessions = {}
    for r in rows(wb["Sessoes"]):
        ev = s(r.get("evento"))
        where = f"Sessoes linha {r['_linha']}"
        a, b = date(r.get("data_inicio"), where), date(r.get("data_fim"), where)
        sessions.setdefault(ev, []).append([a, b or a, s(r.get("local"))])
    for r in rows(wb["Eventos"]):
        name = s(r.get("nome"))
        where = f"Eventos linha {r['_linha']} ({name})"
        if s(r.get("mostrar")).lower() in ("não", "nao", "n", "no"):
            continue
        cat, town = s(r.get("categoria")), s(r.get("localidade"))
        if cat not in ec:
            errors.append(f"{where}: categoria '{cat}' desconhecida (use: {', '.join(sorted(ec))})")
        if town not in out["TOWNS"]:
            errors.append(f"{where}: localidade '{town}' não existe na folha Localidades")
        tl = [t.strip() for t in s(r.get("para_quem")).replace(";", ",").split(",") if t.strip()]
        for t in tl:
            if t not in tags:
                errors.append(f"{where}: 'para_quem' tem '{t}' desconhecido (use: {', '.join(sorted(tags))})")
        e = {**coords(r, where), "cat": cat, "town": town, "name": name, "tags": tl, "d": langs(r, "desc", where),
             "img": img(r, None, where), "icon": s(r.get("icone")) or EV_ICON.get(cat, "📍")}
        a, b = date(r.get("data_inicio"), where), date(r.get("data_fim"), where)
        if a:
            e["start"], e["end"] = a, b or a
        la, lb = date(r.get("ultima_inicio"), where), date(r.get("ultima_fim"), where)
        if la:
            e["last"] = [la, lb or la]
        for f in ("habitual", "epoca"):
            v = langs(r, f, where, required=False)
            if v:
                e["usual" if f == "habitual" else "season"] = v
        if s(r.get("preco")):
            e["price"] = s(r.get("preco"))
        if s(r.get("website")):
            e["url"] = s(r.get("website"))
        if name in sessions:
            e["sessions"] = sorted(sessions.pop(name))
        out["EVENTS"].append(e)
    for ev in sessions:
        errors.append(f"Sessoes: o evento '{ev}' não existe na folha Eventos (o nome tem de ser igual)")

    # ---- Página principal ----
    for r in rows(wb["Pagina_Principal"]):
        vals = [s(r.get(l)) for l in LANGS]
        if not vals[0]:
            continue
        out["SITE_ROWS"].append([v or vals[1] or vals[0] for v in vals])

    # ---- Resultado ----
    if warnings:
        print(f"Avisos ({len(warnings)}):")
        for w in warnings[:40]:
            print("  -", w)
    if errors:
        print(f"\nERROS ({len(errors)}) — nada foi gravado:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    out["_gerado"] = datetime.datetime.now().isoformat(timespec="seconds")
    with open(os.path.join(ROOT, "data", "site.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"OK: data/site.json — {len(out['RESTAURANTS'])} restaurantes, {len(out['EVENTS'])} eventos/atrações, "
          f"{len(out['PLACES'])} locais no mapa, {len(out['SITE_ROWS'])} frases da página principal")

    try:
        import segno, segno.helpers
        q = segno.helpers.make_wifi(ssid=out["WIFI"]["ssid"], password=out["WIFI"]["password"], security="WPA")
        q.save(os.path.join(ROOT, "wifi-qr.svg"), scale=8, border=2, dark="#1a2332", light="#ffffff")
        print("OK: wifi-qr.svg atualizado")
    except ImportError:
        print("Nota: 'segno' não instalado — wifi-qr.svg não foi regenerado (só é preciso se o Wi-Fi mudar)")


if __name__ == "__main__":
    main()
