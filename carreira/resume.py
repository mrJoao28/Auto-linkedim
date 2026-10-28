import html


def render(snapshot):
    profile = snapshot["profile"]
    job = snapshot["job"]
    e = lambda value: html.escape(str(value or ""))
    entries = {item["id"]: item for item in profile.get("entries", [])}
    sections = []
    labels = {"experience": "Experiência", "project": "Projetos", "education": "Formação", "skill": "Habilidades e idiomas"}
    for kind, label in labels.items():
        selected = [entries[i] for i in snapshot["entry_ids"] if i in entries and entries[i].get("type") == kind]
        if not selected:
            continue
        rows = []
        for item in selected:
            skills = ", ".join(item.get("skills", []))
            rows.append(f"<article><h3>{e(item['title'])}</h3><p class='muted'>{e(item.get('organization'))} · {e(item.get('period'))}</p>"
                        f"<p>{e(item.get('description'))}</p><p>{e(skills)}</p><p>{e(item.get('url'))}</p></article>")
        sections.append(f"<section><h2>{label}</h2>{''.join(rows)}</section>")
    contacts = " · ".join(str(profile.get(k, "")) for k in ("email", "phone", "location", "github", "linkedin") if profile.get(k))
    return f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Currículo — {e(job['title'])}</title>
<style>*{{box-sizing:border-box}}body{{font:11pt/1.5 Arial,sans-serif;color:#17212b;max-width:800px;margin:40px auto;padding:0 28px}}h1{{font-size:24pt;margin-bottom:4px}}h2{{font-size:13pt;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}}h3{{font-size:11pt;margin-bottom:0}}p{{margin:5px 0;white-space:pre-line;overflow-wrap:anywhere}}.muted{{color:#555}}article{{break-inside:avoid;margin-bottom:16px}}button{{padding:12px;border:0;background:#17212b;color:white;cursor:pointer}}@media print{{body{{margin:0;max-width:none;padding:0}}button,.hint{{display:none}}@page{{size:A4;margin:16mm}}}}</style>
<button onclick="window.print()">Imprimir / salvar em PDF</button><p class="hint">Revise antes de enviar. No diálogo de impressão, escolha Salvar como PDF.</p>
<h1>{e(profile.get('name'))}</h1><p>{e(profile.get('headline'))}</p><p>{e(contacts)}</p>
<h2>Objetivo</h2><p>{e(job['title'])}</p>
{('<h2>Resumo</h2><p>' + e(profile.get('summary')) + '</p>') if profile.get('summary') else ''}
{''.join(sections)}</html>"""
