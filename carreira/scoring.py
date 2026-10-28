"""Pontuação determinística com evidências rastreáveis, sem serviço externo."""
import re
import unicodedata

VERSION = "1.0.0"
ALIASES = {
    "javascript": ["javascript", "js"], "typescript": ["typescript", "ts"],
    "python": ["python"], "java": ["java"], "c++": ["c++", "cpp"],
    "c#": ["c#", "csharp"], "c": ["c"], "go": ["golang"],
    "react": ["react", "reactjs", "react.js"], "node.js": ["node.js", "nodejs", "node"],
    "sql": ["sql"], "postgresql": ["postgresql", "postgres"], "mysql": ["mysql"],
    "docker": ["docker"], "git": ["git"], "linux": ["linux"],
    "aws": ["aws", "amazon web services"], "azure": ["azure"],
    "html": ["html", "html5"], "css": ["css", "css3"],
    "django": ["django"], "flask": ["flask"], "fastapi": ["fastapi"],
    "spring": ["spring", "spring boot"], "mongodb": ["mongodb", "mongo db"],
    "rest": ["rest", "restful", "api rest", "apis rest"],
    "testes automatizados": ["testes automatizados", "automated testing"],
    "ingles": ["ingles", "english"],
}


def normalize(text):
    return " ".join(unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower().split())


def canonical(text):
    text = normalize(text)
    for key, names in ALIASES.items():
        if text in names:
            return key
    return text


def contains(text, term):
    """Limites impedem Java em JavaScript, Git em GitHub e C em CSS."""
    return bool(re.search(r"(?<![a-z0-9+#])" + re.escape(normalize(term)) + r"(?![a-z0-9+#])", normalize(text)))


def alternatives(label):
    return [canonical(x) for x in re.split(r"\s+(?:ou|or)\s+", label, flags=re.I) if canonical(x)]


def requirements_from_text(description):
    """Sugestões restritas ao vocabulário conhecido; a revisão humana é obrigatória."""
    found = []
    for line in description.splitlines():
        line = line.strip(" -*•\t")
        if not line:
            continue
        keys = [key for key, names in ALIASES.items() if any(contains(line, name) for name in names)]
        if not keys:
            continue
        # Preserve contexto para senioridade, negações, proficiência e alternativas ambíguas.
        contextual = re.search(r"\b(\d+|anos?|years?|nao|not|sem|fluente|fluent|intermediario|intermediate|avancado|advanced|basico|basic|ou|or)\b", normalize(line))
        labels = [line] if contextual else keys
        desirable = bool(re.search(r"desejav|diferencial|preferred|nice to have", normalize(line)))
        for label in labels:
            found.append({"label": label, "weight": 2 if desirable else 5, "eliminatory": False})
    return clean_requirements(found)


def clean_requirements(requirements):
    unique = {}
    for item in requirements:
        label = str(item.get("label", "")).strip()[:500]
        if not label:
            continue
        weight = float(item.get("weight", 5))
        if not 0 < weight <= 100:
            raise ValueError("Cada peso deve ser maior que zero e no máximo 100.")
        key = "|".join(sorted(alternatives(label)))
        value = {"label": label, "weight": weight, "eliminatory": bool(item.get("eliminatory", False))}
        if key in unique:
            unique[key]["weight"] = max(unique[key]["weight"], weight)
            unique[key]["eliminatory"] |= value["eliminatory"]
        else:
            unique[key] = value
    return list(unique.values())


def entry_evidence(entry, requirement):
    if not entry.get("confirmed"):
        return 0, "Informação importada ainda não confirmada."
    tags = {canonical(tag) for tag in entry.get("skills", [])}
    label = requirement["label"]
    # Frases complexas só recebem crédito integral se cadastradas explicitamente como evidência.
    if canonical(label) in tags:
        return 1, "Requisito explicitamente confirmado por você."
    options = alternatives(label)
    if any(option in tags for option in options):
        return 1, "Habilidade explicitamente confirmada por você."
    text = " ".join(str(entry.get(k, "")) for k in ("title", "organization", "description"))
    for option in options:
        names = ALIASES.get(option, [option])
        if any(contains(text, name) for name in names):
            return 0.5, "Menção no conteúdo: confirme o atendimento completo antes de usar."
    return 0, "Não há evidência confirmada."


def analyze(profile, requirements, entry_ids=None):
    requirements = clean_requirements(requirements)
    entries = [e for e in profile.get("entries", []) if entry_ids is None or e["id"] in entry_ids]
    rows = []
    for requirement in requirements:
        evidence = []
        for entry in entries:
            level, reason = entry_evidence(entry, requirement)
            if level:
                evidence.append({"entry_id": entry["id"], "title": entry["title"], "level": level, "reason": reason})
        best = max((e["level"] for e in evidence), default=0)
        rows.append({**requirement, "attainment": best, "evidence": evidence,
                     "status": "atendido" if best == 1 else "parcial" if best else "sem evidência"})
    denominator = sum(r["weight"] for r in rows)
    score = round(100 * sum(r["weight"] * r["attainment"] for r in rows) / denominator, 1) if denominator else None
    return {"algorithm_version": VERSION, "score": score, "requirements": rows,
            "blockers": [r["label"] for r in rows if r["eliminatory"] and r["attainment"] < 1]}


def select_entries(profile, requirements, limit=6):
    """Seleção gulosa por cobertura adicional; não promete ótimo global."""
    candidates = [e for e in profile.get("entries", []) if e.get("confirmed")]
    selected = []
    while candidates and len(selected) < limit:
        current = analyze(profile, requirements, selected)["score"] or 0
        ranked = [(analyze(profile, requirements, selected + [e["id"]])["score"] or 0, e) for e in candidates]
        score, best = max(ranked, key=lambda pair: pair[0])
        if score <= current:
            break
        selected.append(best["id"])
        candidates.remove(best)
    # Formação permanece visível mesmo quando não aparece nos requisitos extraídos.
    if not selected:
        selected = [e["id"] for e in profile.get("entries", []) if e.get("confirmed") and e.get("type") in {"project", "experience"}][:min(3, limit)]
    for entry in profile.get("entries", []):
        if entry.get("confirmed") and entry.get("type") == "education" and entry["id"] not in selected:
            selected.append(entry["id"])
    return selected
