"use strict";
let state = null,
  screen = "dashboard",
  selectedJob = null;
const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const labels = {
  dashboard: "Visão geral",
  jobs: "Candidaturas",
  resumes: "Currículos",
  profile: "Meu perfil",
  posts: "Publicações",
  settings: "Configurações",
  job: "Detalhes da vaga",
};
const statuses = {
  salva: "Salva",
  candidatada: "Candidatada",
  entrevista: "Entrevista",
  oferta: "Oferta",
  encerrada: "Encerrada",
};
const types = {
  experience: "Experiência",
  project: "Projeto",
  education: "Formação",
  skill: "Habilidade / idioma",
};
const paths = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  jobs: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0M10 13h4"/>',
  resumes: '<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h6"/>',
  profile:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  posts: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14zM13 21h8"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  link: '<path d="m10 13 4-4M9 15l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M15 9l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  github:
    '<path d="M9 20v-3c-4 1-4-2-6-2m13 5v-4c0-1-1-2-1-2 4 0 6-2 6-5 0-1 0-3-2-4l-1-3-4 2H9L5 2 4 5C2 6 2 8 2 9c0 3 2 5 6 5 0 0-1 1-1 2"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.resumes}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeURL = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? esc(u.href) : "#";
  } catch {
    return "#";
  }
};
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const time = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const score = (value) =>
  value == null ? "—" : String(value).replace(".", ",") + "%";
const byID = (collection, id) =>
  state[collection].find((item) => item.id === id);
const badge = (text, kind = "neutral") =>
  `<span class="badge ${kind}">${esc(text)}</span>`;
const empty = (title, detail, action, label, ic = "resumes") =>
  `<div class="empty"><div class="empty-icon">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(detail)}</p>${action ? `<button data-action="${action}" class="ghost">${esc(label)} ${icon("arrow")}</button>` : ""}</div>`;
const field = (
  name,
  label,
  value = "",
  placeholder = "",
  kind = "text",
  extra = "",
) =>
  `<div class="field ${extra}"><label for="${name}">${esc(label)}</label><input id="${name}" name="${name}" type="${kind}" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`;
const area = (name, label, value = "", placeholder = "", extra = "") =>
  `<div class="field ${extra}"><label for="${name}">${esc(label)}</label><textarea id="${name}" name="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
function newID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
let toastTimer;
function toast(message, error = false) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.className = "show" + (error ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.className = ""), 6500);
}
async function api(path, data) {
  const response = await fetch(path, {
    method: data ? "POST" : "GET",
    headers: data
      ? { "Content-Type": "application/json", "X-CSRF-Token": state.csrf }
      : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível concluir.");
  return result;
}
async function refresh() {
  state = await api("/api/state");
  render();
}
function navigate(next) {
  screen = next;
  render();
  window.scrollTo(0, 0);
}
function modal(title, body, footer = "") {
  dialog.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button data-action="close" class="ghost" aria-label="Fechar">${icon("close")}</button></div>${body}${footer}`;
  dialog.showModal();
}
function close() {
  dialog.close();
  dialog.innerHTML = "";
}
function heading(eyebrow, title, subtitle, action = "") {
  return `<div class="heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${action}</div>`;
}
function newJobButton() {
  return `<button class="primary" data-action="new-job">${icon("plus")} Nova vaga</button>`;
}
function jobTable(jobs) {
  return `<div class="table-wrap"><table><thead><tr><th>Vaga / empresa</th><th>Situação</th><th>Adicionada</th><th></th></tr></thead><tbody>${jobs.map((j) => `<tr data-job-id="${esc(j.id)}"><td><strong>${esc(j.title)}</strong><small>${esc(j.company || "Empresa não informada")}</small></td><td>${badge(statuses[j.status] || j.status, j.status === "oferta" ? "" : j.status === "entrevista" ? "warn" : "neutral")}</td><td class="muted">${date(j.created_at)}</td><td><button class="ghost small" data-action="open-job" data-id="${esc(j.id)}" aria-label="Abrir ${esc(j.title)}">${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></div>`;
}
function dashboard() {
  const p = state.profile;
  const complete =
    [
      Boolean(p.name),
      Boolean(p.summary),
      p.entries.some((e) => e.confirmed),
      p.entries.some((e) => e.type === "education" && e.confirmed),
    ].filter(Boolean).length * 25;
  return `${heading("Seu espaço de carreira", p.name ? `Bom ter você por aqui, ${p.name.split(" ")[0]}.` : "Cada candidatura, bem preparada.", "Organize suas experiências. Escolha o que merece destaque.", newJobButton())}
<div class="stats">${[
    ["Vagas acompanhadas", state.jobs.length, "Tudo em um só lugar", "jobs"],
    [
      "Candidaturas enviadas",
      state.jobs.filter((j) => j.status !== "salva" && j.applied_at).length,
      "Com histórico preservado",
      "arrow",
    ],
    [
      "Currículos salvos",
      state.resumes.length,
      "Versões independentes",
      "resumes",
    ],
    [
      "Em entrevista",
      state.jobs.filter((j) => j.status === "entrevista").length,
      "Próximas conversas",
      "clock",
    ],
  ]
    .map(
      ([label, n, hint, ic]) =>
        `<div class="stat"><div class="label">${label}${icon(ic)}</div><strong>${n}</strong><div class="hint">${hint}</div></div>`,
    )
    .join("")}</div>
<div class="split"><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Últimas oportunidades</h2><p>O que está no seu radar agora.</p></div><button class="ghost small" data-nav="jobs">Ver todas ${icon("arrow")}</button></div>${state.jobs.length ? jobTable(state.jobs.slice(0, 5)) : empty("Sua próxima oportunidade começa aqui", "Cole a descrição de uma vaga para comparar requisitos e preparar um currículo.", "new-job", "Adicionar primeira vaga", "jobs")}</section>
<section class="panel"><div class="panel-head"><h2>Currículos recentes</h2><span class="muted">${state.resumes.length} versões</span></div>${
    state.resumes.length
      ? state.resumes
          .slice(0, 3)
          .map(
            (r) =>
              `<div class="entry row between"><div><h3>${esc(r.job.title)}</h3><div class="entry-meta">${esc(r.job.company)} · ${date(r.created_at)} · cobertura ${score(r.resume_assessment.score)}</div></div><a class="button ghost small" href="/resume/${esc(r.id)}" target="_blank" rel="noopener">Abrir ${icon("arrow")}</a></div>`,
          )
          .join("")
      : empty(
          "Um currículo para cada contexto",
          "As versões que você gerar ficam guardadas aqui, vinculadas à vaga.",
          null,
        )
  }</section></div>
<div class="stack"><section class="panel"><div class="panel-head"><h2>Seu ponto de partida</h2>${badge(complete + "%", complete === 100 ? "" : "neutral")}</div><div class="panel-body"><div class="progress"><span style="width:${complete}%"></span></div><p class="hint" style="margin:12px 0 22px">Quanto melhor o perfil, mais útil a comparação.</p>${[
    [
      "01",
      "Conte sua trajetória",
      "Adicione formação, experiências e habilidades.",
      "profile",
      "Organizar perfil",
    ],
    [
      "02",
      "Traga seus projetos",
      "Importe do GitHub e confirme sua participação.",
      "settings",
      "Conectar GitHub",
    ],
    [
      "03",
      "Prepare a candidatura",
      "Revise os requisitos antes de gerar o currículo.",
      "jobs",
      "Explorar candidaturas",
    ],
  ]
    .map(
      ([n, t, d, s, l]) =>
        `<div class="step"><span class="step-no">${n}</span><div><h3>${t}</h3><p>${d}</p><a href="#" data-nav="${s}">${l} →</a></div></div>`,
    )
    .join("")}</div></section>
<section class="panel"><div class="panel-body"><p class="eyebrow">Critérios claros</p><h3>Uma nota que você pode conferir.</h3><p class="hint">Cada requisito tem um peso e uma evidência. A pontuação mede compatibilidade neste sistema; não prevê aprovação pela empresa.</p></div></section></div></div>`;
}
function jobsView() {
  return `${heading("Oportunidades", "Suas candidaturas", "Da primeira leitura à resposta da empresa.", newJobButton())}<div class="toolbar"><input id="job-search" aria-label="Buscar vagas" placeholder="Buscar por cargo ou empresa…"><select id="job-filter" aria-label="Filtrar situação"><option value="">Todas as situações</option>${Object.entries(
    statuses,
  )
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join(
      "",
    )}</select></div><section class="panel">${state.jobs.length ? jobTable(state.jobs) : empty("Nenhuma vaga por enquanto", "Salve a descrição completa para construir uma análise que você possa revisar.", "new-job", "Adicionar vaga", "jobs")}</section>`;
}
function profileView() {
  const p = state.profile;
  return `${heading("Sua trajetória", "O conteúdo vem de você.", "Experiências reais, com contexto suficiente para contar uma boa história.", `<button class="primary" type="submit" form="profile-form">${icon("check")} Salvar perfil</button>`)}<div class="split"><div class="stack"><section class="panel"><div class="panel-head"><h2>Informações pessoais</h2></div><form id="profile-form" class="panel-body form-grid">${field("name", "Nome completo", p.name, "Como deseja aparecer no currículo")}${field("headline", "Título profissional", p.headline, "Estudante de Engenharia de Computação")}${field("email", "E-mail", p.email, "voce@exemplo.com", "email")}${field("phone", "Telefone", p.phone, "(92) 99999-9999")}${field("location", "Localização", p.location, "Manaus, AM")}${field("github", "GitHub", p.github, "https://github.com/seuusuario", "url")}${field("linkedin", "LinkedIn", p.linkedin, "https://www.linkedin.com/in/seuperfil", "url", "full")}${area("summary", "Resumo profissional", p.summary, "Descreva sua formação, interesses e experiências sem inventar qualificações.", "full")}</form></section></div>
<section class="panel"><div class="panel-head"><div><h2>Evidências do seu perfil</h2><p>Projetos, experiências, formação e idiomas.</p></div><button class="ghost small" data-action="new-entry">${icon("plus")} Adicionar</button></div>${p.entries.length ? p.entries.map(entryCard).join("") : empty("Além de uma lista de habilidades", "Cadastre onde você usou cada tecnologia e o que fez. Projetos acadêmicos também contam.", "new-entry", "Adicionar evidência", "profile")}</section></div>`;
}
function entryCard(e) {
  return `<article class="entry"><div class="row between"><h3>${esc(e.title)}</h3><button class="ghost small" data-action="edit-entry" data-id="${esc(e.id)}">Editar</button></div><div class="entry-meta">${esc(types[e.type])}${e.organization ? " · " + esc(e.organization) : ""}${e.period ? " · " + esc(e.period) : ""}</div><p>${esc((e.description || "").slice(0, 240))}${(e.description || "").length > 240 ? "…" : ""}</p><div class="row wrap">${badge(e.confirmed ? "Confirmado por você" : "Revisão pendente", e.confirmed ? "" : "warn")}${(
    e.skills || []
  )
    .slice(0, 5)
    .map((s) => `<span class="chip">${esc(s)}</span>`)
    .join("")}</div></article>`;
}
function entryModal(id) {
  const e = state.profile.entries.find((e) => e.id === id) || {
    id: newID(),
    type: "project",
    skills: [],
    confirmed: false,
  };
  modal(
    id ? "Editar evidência" : "Adicionar evidência",
    `<form id="entry-form" data-id="${esc(e.id)}"><div class="dialog-content"><div class="form-grid"><div class="field"><label for="type">Tipo</label><select id="type" name="type">${Object.entries(
      types,
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${e.type === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></div>${field("title", "Título", e.title, "API de gestão de tarefas")}${field("organization", "Empresa / instituição", e.organization, "Projeto pessoal ou universidade")}${field("period", "Período", e.period, "Mar. 2025 — atual")}${area("description", "O que você fez", e.description, "Descreva sua contribuição, tecnologias e resultados reais.", "full")}${field("skills", "Habilidades confirmadas", (e.skills || []).join(", "), "Python, PostgreSQL, Docker", "text", "full")}${field("url", "Link do projeto ou referência", e.url, "https://…", "url", "full")}</div>${e.suggested_skills?.length ? `<p class="hint">Sugestões da importação: ${esc(e.suggested_skills.join(", "))}. Adicione somente o que você realmente utilizou.</p>` : ""}<label class="check"><input type="checkbox" name="confirmed" ${e.confirmed ? "checked" : ""}>Confirmo que estas informações descrevem minha experiência real. Habilidades confirmadas contam integralmente na análise.</label></div><div class="dialog-footer">${id ? `<button type="button" class="ghost danger" data-action="delete-entry" data-id="${esc(e.id)}">Excluir</button>` : ""}<button type="submit" class="primary">Salvar evidência</button></div></form>`,
  );
}
function reqRows(reqs) {
  return reqs
    .map(
      (r) =>
        `<div class="req-grid req-item"><input aria-label="Requisito" class="req-label" value="${esc(r.label)}" placeholder="Ex.: Python"><input aria-label="Peso do requisito" class="req-weight" type="number" min="0.1" max="100" step="0.1" value="${r.weight || 5}"><label class="check"><input aria-label="Requisito eliminatório" type="checkbox" class="req-eliminatory" ${r.eliminatory ? "checked" : ""}>Sim</label><button type="button" class="ghost" data-action="remove-req" aria-label="Remover requisito">${icon("close")}</button></div>`,
    )
    .join("");
}
function reqEditor(reqs) {
  return `<div class="req-grid req-head"><span>Requisito</span><span>Peso</span><span>Eliminatório</span><span></span></div><div class="req-list">${reqRows(reqs)}</div><button type="button" class="ghost small" data-action="add-req">${icon("plus")} Requisito</button>`;
}
function readReqs(root) {
  return [...root.querySelectorAll(".req-item")]
    .map((row) => ({
      label: row.querySelector(".req-label").value,
      weight: Number(row.querySelector(".req-weight").value),
      eliminatory: row.querySelector(".req-eliminatory").checked,
    }))
    .filter((r) => r.label.trim());
}
function newJob() {
  modal(
    "Adicionar oportunidade",
    `<form id="job-form"><div class="dialog-content"><div class="form-grid">${field("title", "Cargo", "", "Desenvolvedor backend júnior")}${field("company", "Empresa", "", "Nome da empresa")}${field("url", "Link da vaga", "", "https://…", "url", "full")}${area("description", "Descrição completa da vaga", "", "Cole responsabilidades, requisitos e diferenciais.", "full")}</div><div class="row between" style="margin:24px 0 10px"><h3>Requisitos para comparar</h3><button type="button" class="ghost small" data-action="extract">Identificar sugestões</button></div><p class="hint">A extração usa regras e um vocabulário de tecnologias. Revise a descrição inteira, acrescente o que faltar e confira condições como “ou”, nível de idioma e anos de experiência.</p><div id="requirements-editor">${reqEditor([])}</div></div><div class="dialog-footer"><button type="button" class="ghost" data-action="close">Cancelar</button><button class="primary" type="submit">Salvar vaga ${icon("arrow")}</button></div></form>`,
  );
}
let assessment = null;
function jobView() {
  const j = byID("jobs", selectedJob);
  if (!j) return jobsView();
  const resumes = state.resumes.filter((r) => r.job_id === j.id);
  return `${heading(j.company || "Oportunidade", j.title, "Ajuste os critérios e confira o que sustenta cada ponto.", `<div class="row"><button class="ghost" data-nav="jobs">Voltar</button><button class="primary" data-action="generate" data-id="${esc(j.id)}">${icon("resumes")} Gerar currículo</button></div>`)}
<div class="split"><div class="stack"><section class="panel"><div class="panel-head"><h2>Requisitos e pesos</h2><button class="ghost small" data-action="analyze" data-id="${esc(j.id)}">Salvar e analisar ${icon("arrow")}</button></div><div class="panel-body" id="job-requirements">${reqEditor(j.requirements)}<p class="hint">Peso maior aumenta a importância. Marque “eliminatório” somente quando a vaga realmente indicar essa condição.</p></div></section><section class="panel"><div class="panel-head"><h2>Leitura da compatibilidade</h2></div><div id="analysis-result" class="panel-body">${assessment ? analysisHTML(assessment) : `<p class="muted">Clique em “Salvar e analisar” para conferir as evidências requisito por requisito.</p>`}</div></section><section class="panel"><div class="panel-head"><h2>Descrição original</h2>${j.url ? `<a class="button small ghost" href="${safeURL(j.url)}" target="_blank" rel="noopener">Abrir vaga ${icon("arrow")}</a>` : ""}</div><div class="panel-body" style="white-space:pre-line;font-size:12px;color:var(--muted)">${esc(j.description)}</div></section></div>
<div class="stack"><section class="panel"><div class="panel-head"><h2>Acompanhamento</h2></div><form id="status-form" data-id="${esc(j.id)}" class="panel-body"><div class="field"><label for="status">Situação</label><select name="status" id="status">${Object.entries(
    statuses,
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${j.status === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></div>${area("notes", "Anotações", j.notes, "Contatos, datas e próximos passos.")}<button class="ghost" type="submit">Salvar acompanhamento</button>${j.applied_at ? `<p class="hint">Candidatura registrada em ${time(j.applied_at)}.</p>` : ""}</form></section>
<section class="panel"><div class="panel-head"><h2>Versões desta vaga</h2>${badge(resumes.length + " salvas")}</div>${resumes.length ? resumes.map((r) => `<div class="entry"><h3>${date(r.created_at)}</h3><p>Cobertura no currículo: ${score(r.resume_assessment.score)}</p><div class="row wrap"><a class="button small ghost" href="/resume/${esc(r.id)}" target="_blank" rel="noopener">Abrir / PDF</a><button class="ghost small" data-action="mark-sent" data-id="${esc(r.id)}">${j.sent_resume_id === r.id ? "Versão enviada ✓" : "Marcar como enviada"}</button></div></div>`).join("") : empty("Histórico preservado", "Cada currículo gerado cria uma nova versão, sem alterar as anteriores.", null)}</section><div class="notice">Nada é enviado automaticamente para recrutadores. Marcar como enviada apenas registra a candidatura.</div></div></div>`;
}
function analysisHTML(a) {
  return `<div class="score-layout"><div><div class="score-number">${a.score == null ? "—" : String(a.score).replace(".", ",")}<small>${a.score == null ? "" : " / 100"}</small></div><p class="score-label">Compatibilidade do perfil · algoritmo ${esc(a.algorithm_version)}</p></div><div><p class="hint">Nota = 100 × soma(peso × atendimento) ÷ soma dos pesos. Evidência explícita vale 1; menção contextual vale 0,5; ausência vale 0.</p><p class="hint">Não mede sua chance de contratação e não reproduz a nota interna de um ATS.</p></div></div>${a.blockers.length ? `<div class="notice warn" style="margin-top:20px">Eliminatórios sem atendimento integral: ${esc(a.blockers.join("; "))}.</div>` : ""}<div style="margin-top:24px">${a.requirements.map((r) => `<div class="entry" style="padding:15px 0"><div class="row between"><h3>${esc(r.label)} <span class="entry-meta">· peso ${r.weight}</span></h3>${badge(r.status, r.attainment === 1 ? "" : r.attainment === 0.5 ? "warn" : "bad")}</div>${r.evidence.length ? r.evidence.map((e) => `<div class="evidence">${esc(e.title)} · ${esc(e.reason)}</div>`).join("") : `<div class="evidence">Cadastre uma experiência verdadeira ou confirme informações importadas. Repetir palavras não aumenta a nota.</div>`}</div>`).join("") || `<p class="hint">Sem requisitos, não há pontuação. Cadastre e revise os critérios acima.</p>`}</div>`;
}
function generatedResumesView() {
  return `${heading("Documentos", "Seu histórico, sem sobrescritas.", "A versão enviada continua igual, mesmo quando sua trajetória evolui.")}<section class="panel">${state.resumes.length ? `<div class="table-wrap"><table><thead><tr><th>Currículo / vaga</th><th>Perfil</th><th>Cobertura</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>${state.resumes.map((r) => `<tr><td><strong>${esc(r.job.title)}</strong><small>${esc(r.job.company)}</small></td><td>${score(r.assessment.score)}</td><td>${score(r.resume_assessment.score)}</td><td class="muted">${time(r.created_at)}</td><td><div class="row"><a class="button ghost small" href="/resume/${esc(r.id)}" target="_blank" rel="noopener">PDF ${icon("download")}</a><button class="ghost small" data-action="copy-resume" data-id="${esc(r.id)}">Nova versão</button><button class="ghost small" data-action="mark-sent" data-id="${esc(r.id)}">${byID("jobs", r.job_id)?.sent_resume_id === r.id ? "Enviado ✓" : "Registrar envio"}</button></div></td></tr>`).join("")}</tbody></table></div>` : empty("O currículo certo começa na vaga", "Cadastre seus dados, adicione uma oportunidade e gere a primeira versão.", "new-job", "Adicionar oportunidade")}</section><p class="footnote">A cobertura considera apenas as evidências incluídas no documento. A seleção automática prioriza cobertura adicional e mantém a formação; você pode criar uma nova versão para ajustar o resumo e a seleção.</p>`;
}
function copyModal(id) {
  const r = byID("resumes", id);
  modal(
    "Criar nova versão",
    `<form id="resume-copy-form" data-id="${esc(id)}"><div class="dialog-content"><p class="hint">A versão anterior será preservada. Revise o texto e escolha as evidências desta cópia.</p>${area("resume-summary", "Resumo profissional", r.profile.summary)}${state.settings.ai_provider !== "template" ? `<button type="button" class="ghost small" style="margin-bottom:16px" data-action="suggest-summary" data-id="${esc(id)}">Sugerir resumo com IA</button>` : ""}${r.profile.entries
      .filter((e) => e.confirmed)
      .map(
        (e) =>
          `<label class="check"><input type="checkbox" name="entry_id" value="${esc(e.id)}" ${r.entry_ids.includes(e.id) ? "checked" : ""}>${esc(types[e.type])}: ${esc(e.title)}</label>`,
      )
      .join(
        "",
      )}</div><div class="dialog-footer"><button type="submit" class="primary">Salvar nova versão</button></div></form>`,
  );
}
function postsView() {
  const provider = state.settings.ai_provider;
  return `${heading("Presença profissional", "Compartilhe o que você constrói.", "Rascunhos com base nos seus projetos. Sua revisão vem antes da publicação.", `<button class="primary" data-action="draft-modal">${icon("plus")} Novo rascunho</button>`)}<div class="notice ${provider !== "template" ? "" : "warn"}">${provider === "chatgpt" ? "Geração com seu plano ChatGPT. Usa os limites da sua assinatura. Revise os fatos antes de publicar." : provider === "ollama" ? "IA local selecionada. Revise os fatos: modelos também podem produzir afirmações incorretas." : "Modo gratuito sem IA: os rascunhos usam um modelo de texto. Em Configurações, você pode escolher seu plano ChatGPT ou o Ollama local."}</div><section class="panel">${state.posts.length ? state.posts.map(postCard).join("") : empty("Seu trabalho merece contexto", "Escolha uma evidência confirmada do seu perfil para preparar a primeira publicação.", "draft-modal", "Preparar rascunho", "posts")}</section><p class="footnote">Horários seguem o fuso do seu navegador. O agendamento funciona enquanto este aplicativo estiver aberto no computador. Atrasos de até uma hora são retomados; depois disso, o texto volta para revisão.</p>`;
}
function postCard(p) {
  const scheduled = p.status === "agendado",
    draft = p.status === "rascunho",
    published = p.status === "publicado";
  return `<article class="post-card" data-post="${esc(p.id)}"><div class="row between"><div class="row">${badge(published ? "Publicado" : scheduled ? "Agendado" : draft ? "Rascunho" : "Verifique no LinkedIn", published ? "" : draft ? "neutral" : "warn")}<span class="entry-meta">${p.method === "chatgpt" ? "Plano ChatGPT" : p.method === "ollama" ? "IA local" : "Modelo de texto"} · ${date(p.created_at)}</span></div>${p.url ? `<a class="inline-link" href="${safeURL(p.url)}" target="_blank" rel="noopener">Ver publicação ↗</a>` : ""}</div><textarea class="post-text" aria-label="Texto da publicação" maxlength="3000" ${draft ? "" : "readonly"}>${esc(p.text)}</textarea><div class="post-actions"><span class="entry-meta post-count">${p.text.length}/3.000 caracteres${scheduled ? " · " + time(p.scheduled_at) : ""}</span>${draft ? `<div class="row wrap"><button class="ghost small" data-action="save-post" data-id="${esc(p.id)}">Salvar texto</button><button class="ghost small" data-action="schedule-modal" data-id="${esc(p.id)}">${icon("clock")} Agendar</button><button class="primary small" data-action="publish-modal" data-id="${esc(p.id)}">Publicar ${icon("arrow")}</button></div>` : scheduled ? `<button class="ghost small" data-action="cancel-schedule" data-id="${esc(p.id)}">Cancelar agendamento</button>` : p.status === "verificar" ? `<button class="ghost small" data-action="recover-post" data-id="${esc(p.id)}">Já conferi no LinkedIn</button>` : ""}</div>${p.error ? `<p class="hint danger">${esc(p.error)}</p>` : ""}</article>`;
}
function baseSettingsView() {
  const i = state.integrations;
  return `${heading("Preferências", "Local por escolha.", "Seus dados no computador. Conexões apenas quando você precisar.")}<div class="stack"><section class="panel"><div class="panel-head"><h2>Contas e importações</h2></div><div class="panel-body">${["github", "linkedin"].map((p) => `<div class="connection"><div><div class="row"><h3>${p === "github" ? "GitHub" : "LinkedIn"}</h3>${badge(i[p].connected ? "Conectado" : i[p].configured ? "Pronto para conectar" : "Configuração pendente", i[p].connected ? "" : "neutral")}</div><p>${p === "github" ? "Importe repositórios públicos. Permissão de leitura do perfil; sem acesso de escrita ao código." : "Login e publicação no perfil. A API padrão não importa todo o histórico profissional."}</p></div><button class="ghost small" data-action="${i[p].connected ? "disconnect" : "connect"}" data-provider="${p}">${i[p].connected ? "Desconectar" : "Conectar"} ${icon("arrow")}</button></div>`).join("")}
<div class="connection"><div><h3>Importar projetos públicos</h3><p>Funciona com seu usuário do GitHub, mesmo sem configurar login.</p></div><button class="ghost small" data-action="import-github-modal">Importar ${icon("arrow")}</button></div><div class="connection"><div><h3>Trazer texto do LinkedIn</h3><p>Cole suas experiências. A importação fica pendente até sua revisão.</p></div><button class="ghost small" data-action="import-linkedin-modal">Importar texto</button></div><p class="hint">Os tokens de GitHub e LinkedIn ficam na memória: reconecte após reiniciar. Configure os aplicativos e callbacks seguindo <a class="inline-link" href="https://github.com/mrJoao28/Auto-linkedim/blob/main/docs/INTEGRACOES.md" target="_blank" rel="noopener">o guia de integrações</a>.</p></div></section>
<section class="panel"><div class="panel-head"><h2>Geração com IA local</h2>${badge(i.ollama.configured ? "Configurado" : "Opcional", i.ollama.configured ? "" : "neutral")}</div><div class="panel-body"><p class="muted">Os currículos e as notas funcionam sem IA. Para rascunhos de postagens, o aplicativo pode usar um modelo instalado no Ollama.</p><p class="hint">Instale o Ollama, baixe um modelo compatível com seu computador e coloque o nome exato em <code>OLLAMA_MODEL</code> no arquivo <code>.env</code>. Reinicie o aplicativo. Nenhuma chave de API paga é usada.</p><p class="hint">Configuração detectada não significa que o serviço foi testado: a conexão é verificada ao gerar o texto.</p></div></section>
<section class="panel"><div class="panel-head"><h2>Dados e backup</h2></div><div class="panel-body"><p class="muted">Perfil, vagas, currículos e postagens ficam no SQLite local. O backup JSON contém dados pessoais; guarde em um lugar privado.</p><div class="row wrap" style="margin-top:20px"><button class="ghost" data-action="backup">${icon("download")} Exportar backup</button><button class="ghost" data-action="restore-modal">Restaurar backup</button></div><p class="hint">Restaurar substitui os dados atuais. O aplicativo cria uma cópia de segurança antes da troca. Credenciais e tokens não fazem parte do backup. Agendamentos restaurados voltam para rascunho.</p></div></section></div>`;
}
function render() {
  const content =
    {
      dashboard,
      jobs: jobsView,
      profile: profileView,
      resumes: resumesView,
      job: jobView,
      posts: postsView,
      settings: settingsView,
    }[screen] || dashboard;
  const initials = (state.profile.name || "Eu")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#" data-nav="dashboard"><span class="brand-mark">A</span><span>Auto-linkedim<br><small>ESPAÇO DE CARREIRA</small></span></a><div class="nav-label">MEU ESPAÇO</div><nav class="nav" aria-label="Navegação principal">${["dashboard", "jobs", "resumes", "profile", "posts", "settings"].map((s) => `<button data-nav="${s}" class="${screen === s || (screen === "job" && s === "jobs") ? "active" : ""}" ${screen === s ? 'aria-current="page"' : ""}>${icon(s)}${labels[s]}${s === "jobs" ? `<span class="count">${state.jobs.length}</span>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="local"><span class="dot"></span> Funcionando localmente</div><p>Seu progresso fica com você.</p></div></aside><main class="main"><header class="topbar"><div class="crumb"><span>Meu espaço</span><span>/</span><span>${labels[screen]}</span></div><div class="row"><span>${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date())}</span><div class="avatar">${esc(initials)}</div></div></header><div class="content">${content()}</div></main></div>`;
}

function resumesView() {
  return (
    generatedResumesView() +
    `<section class="panel" style="margin-top:24px"><div class="panel-head"><div><h2>PDFs que você já enviou</h2><p>Arquivos originais preservados, sem pontuação automática do conteúdo.</p></div><button class="ghost small" data-action="attach-modal">${icon("plus")} Arquivar PDF</button></div>${state.attachments.length ? state.attachments.map((a) => `<div class="entry row between"><div><h3>${esc(a.filename)}</h3><div class="entry-meta">${esc(byID("jobs", a.job_id)?.title || "Vaga arquivada")} · ${a.sent_at ? date(a.sent_at) : date(a.created_at)} · ${(a.size / 1000).toFixed(0)} KB</div><p>${esc(a.notes || "")}</p></div><a class="button ghost small" href="/attachment/${esc(a.id)}" download>Baixar ${icon("download")}</a></div>`).join("") : empty("Guarde também os documentos anteriores", "Selecione a vaga e anexe o PDF exato que você enviou. Máximo de 5 MB por arquivo.", "attach-modal", "Arquivar currículo enviado")}</section>`
  );
}
function settingsView() {
  const c = state.integrations.chatgpt;
  const panel = `<section class="panel"><div class="panel-head"><div><h2>Seu plano ChatGPT</h2><p>Conexão oficial para este aplicativo local de código aberto.</p></div>${badge(c.connected ? (c.plan_enabled ? "Conectado" : "Uso do plano não autorizado") : "Não conectado", c.connected && c.plan_enabled ? "" : "neutral")}</div><div class="panel-body"><div class="connection"><div><h3>Use sua assinatura Plus</h3><p>${c.connected ? esc(c.email || "Conta conectada") : "Entre na sua conta e autorize o uso do plano. Não precisa de API key."}</p><p class="hint">Consome os limites existentes da assinatura. Disponibilidade e modelos dependem da sua conta.</p></div><button class="${c.connected ? "ghost" : "primary"}" data-action="${c.connected ? "disconnect" : "connect"}" data-provider="chatgpt">${c.connected ? "Desconectar" : "Continue with ChatGPT"}</button></div>${c.connected ? `<form id="model-form" class="row wrap" style="margin-top:18px"><div class="field" style="flex:1;margin:0"><label for="chatgpt-model">Modelo da sua conta</label><select name="model" id="chatgpt-model"><option value="">${c.model ? "Selecionado: " + esc(c.model) : "Carregue a lista de modelos"}</option>${c.models.map((m) => `<option value="${esc(m.slug)}" ${m.slug === c.model ? "selected" : ""}>${esc(m.display_name)}</option>`).join("")}</select></div><button type="button" class="ghost" data-action="load-models">Carregar modelos</button><button type="submit" class="ghost">Selecionar modelo</button></form>` : ""}<p class="hint">A credencial fica protegida na pasta data, fora do Git. O backup de carreira não inclui essa credencial. Para revogar o acesso na OpenAI, use as configurações da sua conta ChatGPT.</p></div></section>
 <section class="panel"><div class="panel-head"><h2>Como gerar os textos</h2></div><form id="provider-form" class="panel-body"><div class="field"><label for="provider">Provedor de geração</label><select name="provider" id="provider">${[
   ["template", "Modelo de texto — sem IA, sem cobrança"],
   ["chatgpt", "ChatGPT — usa meu plano autorizado"],
   ["ollama", "Ollama — IA no meu computador"],
 ]
   .map(
     ([v, l]) =>
       `<option value="${v}" ${state.settings.ai_provider === v ? "selected" : ""}>${l}</option>`,
   )
   .join(
     "",
   )}</select></div><button class="ghost" type="submit">Salvar preferência</button><p class="hint">A pontuação sempre usa o algoritmo local. Ao selecionar ChatGPT, só o contexto necessário para o texto solicitado é enviado à OpenAI. Nenhuma publicação ocorre durante a geração.</p></form></section>`;
  return baseSettingsView().replace(
    '<div class="stack">',
    '<div class="stack">' + panel,
  );
}
async function savePostText(id) {
  const card = document.querySelector(`[data-post="${CSS.escape(id)}"]`);
  if (card)
    return api("/api/post-save", {
      id,
      text: card.querySelector(".post-text").value,
    });
  return byID("posts", id);
}
const actions = {
  "attach-modal": () => {
    if (!state.jobs.length)
      throw new Error("Cadastre a vaga para vincular o arquivo ao histórico.");
    modal(
      "Arquivar currículo em PDF",
      `<form id="attachment-form"><div class="dialog-content"><div class="field"><label for="attachment-job">Vaga relacionada</label><select name="job_id" id="attachment-job">${state.jobs.map((j) => `<option value="${esc(j.id)}">${esc(j.title)} · ${esc(j.company)}</option>`).join("")}</select></div><div class="field"><label for="attachment-file">PDF original · até 5 MB</label><input type="file" id="attachment-file" accept="application/pdf,.pdf" required></div>${field("sent_at", "Data do envio (opcional)", "", "", "date")}${area("attachment-notes", "Anotações", "")}<label class="check"><input type="checkbox" name="mark_sent" checked>Registrar esta vaga como candidatura enviada com este arquivo.</label></div><div class="dialog-footer"><button class="primary" type="submit">Guardar PDF original</button></div></form>`,
    );
  },
  "load-models": async () => {
    await api("/api/chatgpt-models", {});
    await refresh();
    toast("Modelos da sua conta carregados.");
  },
  "suggest-summary": async (el) => {
    toast("Preparando sugestão com a IA selecionada…");
    const result = await api("/api/suggest-summary", { id: el.dataset.id });
    dialog.querySelector('[name="resume-summary"]').value = result.text;
    toast("Sugestão pronta. Confira os fatos antes de salvar a nova versão.");
  },
  close: close,
  "new-job": newJob,
  "new-entry": () => entryModal(),
  "edit-entry": (el) => entryModal(el.dataset.id),
  "open-job": (el) => {
    selectedJob = el.dataset.id;
    assessment = null;
    navigate("job");
  },
  "add-req": (el) => {
    const root = el.closest("#requirements-editor,#job-requirements");
    root
      .querySelector(".req-list")
      .insertAdjacentHTML("beforeend", reqRows([{ label: "", weight: 5 }]));
  },
  "remove-req": (el) => el.closest(".req-item").remove(),
  extract: async () => {
    const desc = dialog.querySelector('[name="description"]').value;
    if (!desc.trim()) throw new Error("Cole a descrição primeiro.");
    const result = await api("/api/extract", { description: desc });
    dialog.querySelector(".req-list").innerHTML = reqRows(result.requirements);
    toast("Sugestões identificadas. Confira e acrescente requisitos ausentes.");
  },
  analyze: async (el) => {
    assessment = await api("/api/analyze", {
      id: el.dataset.id,
      requirements: readReqs(document.querySelector("#job-requirements")),
    });
    await refresh();
    toast("Critérios salvos e análise atualizada.");
  },
  generate: async (el) => {
    const result = await api("/api/generate", {
      id: el.dataset.id,
      requirements: readReqs(document.querySelector("#job-requirements")),
    });
    await refresh();
    toast("Nova versão salva. Abra o documento para revisar e exportar.");
    screen = "resumes";
    render();
  },
  "copy-resume": (el) => copyModal(el.dataset.id),
  "mark-sent": (el) =>
    modal(
      "Registrar candidatura",
      `<div class="dialog-content"><p>Este currículo será marcado como a versão enviada. Isso registra seu histórico; não envia o arquivo para a empresa.</p></div><div class="dialog-footer"><button class="ghost" data-action="close">Cancelar</button><button class="primary" data-action="confirm-sent" data-id="${esc(el.dataset.id)}">Registrar envio</button></div>`,
    ),
  "confirm-sent": async (el) => {
    await api("/api/mark-sent", { id: el.dataset.id });
    close();
    await refresh();
    toast("Versão enviada registrada.");
  },
  "delete-entry": async (el) => {
    const id = el.dataset.id;
    modal(
      "Excluir evidência do perfil",
      `<div class="dialog-content"><p>Excluir esta evidência? Os currículos já salvos manterão seu conteúdo original.</p></div><div class="dialog-footer"><button class="ghost" data-action="close">Cancelar</button><button class="danger" data-action="confirm-delete-entry" data-id="${esc(id)}">Excluir evidência</button></div>`,
    );
  },
  "confirm-delete-entry": async (el) => {
    await api("/api/profile", {
      ...state.profile,
      entries: state.profile.entries.filter((e) => e.id !== el.dataset.id),
    });
    close();
    await refresh();
    toast("Evidência excluída do perfil.");
  },
  connect: async (el) => {
    const result = await api("/api/connect", { provider: el.dataset.provider });
    location.assign(result.url);
  },
  disconnect: async (el) => {
    await api("/api/disconnect", { provider: el.dataset.provider });
    await refresh();
    toast("Conta desconectada.");
  },
  "import-github-modal": () =>
    modal(
      "Importar do GitHub",
      `<form id="github-form"><div class="dialog-content"><p class="hint">Importa nome, descrição, link e sugestões de tecnologias dos repositórios públicos que não sejam forks. Revise cada item antes de confirmar. Importações repetidas não duplicam projetos.</p>${field("username", "Usuário do GitHub", "", "seuusuario")}</div><div class="dialog-footer"><button class="primary" type="submit">Importar projetos públicos</button></div></form>`,
    ),
  "import-linkedin-modal": () =>
    modal(
      "Importar texto do LinkedIn",
      `<form id="linkedin-form"><div class="dialog-content"><p class="hint">Cole as informações que deseja aproveitar. O texto será guardado como evidência pendente para você editar e dividir em experiências individuais.</p>${area("text", "Texto do perfil", "", "Formação, experiências e responsabilidades…")}</div><div class="dialog-footer"><button class="primary" type="submit">Importar para revisão</button></div></form>`,
    ),
  "draft-modal": () => {
    const options = state.profile.entries.filter((e) => e.confirmed);
    if (!options.length)
      throw new Error("Cadastre e confirme uma evidência no perfil primeiro.");
    modal(
      "Preparar uma publicação",
      `<form id="draft-form"><div class="dialog-content"><p class="hint">Escolha um projeto ou experiência. O texto será salvo como rascunho e não será publicado agora.</p><div class="field"><label for="entry_id">Evidência de origem</label><select id="entry_id" name="entry_id">${options.map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("")}</select></div></div><div class="dialog-footer"><button class="primary" type="submit">Gerar rascunho</button></div></form>`,
    );
  },
  "save-post": async (el) => {
    await savePostText(el.dataset.id);
    await refresh();
    toast("Rascunho salvo.");
  },
  "publish-modal": async (el) => {
    const p = await savePostText(el.dataset.id);
    state.posts = state.posts.map((x) => (x.id === p.id ? p : x));
    modal(
      "Publicar no LinkedIn",
      `<div class="dialog-content"><p>Este texto será publicado publicamente no seu perfil conectado. Confira o conteúdo abaixo.</p><div class="attachment" style="white-space:pre-line;margin-top:20px">${esc(p.text)}</div><label class="check"><input id="publish-approval" type="checkbox">Revisei o texto e autorizo esta publicação no meu LinkedIn.</label></div><div class="dialog-footer"><button class="ghost" data-action="close">Cancelar</button><button class="primary" data-action="confirm-publish" data-id="${esc(p.id)}">Publicar agora</button></div>`,
    );
  },
  "confirm-publish": async (el) => {
    if (!dialog.querySelector("#publish-approval").checked)
      throw new Error("Marque a autorização após revisar.");
    try {
      await api("/api/publish", { id: el.dataset.id, confirmed: true });
      close();
      await refresh();
      toast("Publicação criada no LinkedIn.");
    } catch (error) {
      close();
      await refresh();
      throw error;
    }
  },
  "schedule-modal": async (el) => {
    await savePostText(el.dataset.id);
    modal(
      "Agendar publicação",
      `<form id="schedule-form" data-id="${esc(el.dataset.id)}"><div class="dialog-content"><div class="notice warn">O aplicativo precisa estar funcionando no computador e conectado ao LinkedIn para publicar no horário.</div>${field("scheduled_at", "Data e horário no seu fuso", "", "", "datetime-local")}<label class="check"><input name="approved" type="checkbox" required>Revisei o texto e autorizo sua publicação pública no horário escolhido.</label></div><div class="dialog-footer"><button type="submit" class="primary">Confirmar agendamento</button></div></form>`,
    );
  },
  "cancel-schedule": async (el) => {
    await api("/api/cancel-schedule", { id: el.dataset.id });
    await refresh();
    toast("Agendamento cancelado.");
  },
  "recover-post": (el) =>
    modal(
      "Evitar uma publicação duplicada",
      `<div class="dialog-content"><p>A tentativa anterior ficou sem confirmação. Confira seu perfil no LinkedIn: se o post já existe, mantenha este registro como está. Só recupere o rascunho se ele não foi publicado.</p><label class="check"><input id="recover-checked" type="checkbox">Conferi meu LinkedIn e a publicação não existe.</label></div><div class="dialog-footer"><button class="ghost" data-action="close">Cancelar</button><button class="primary" data-action="confirm-recover" data-id="${esc(el.dataset.id)}">Recuperar rascunho</button></div>`,
    ),
  "confirm-recover": async (el) => {
    if (!document.querySelector("#recover-checked").checked)
      throw new Error("Confira se o post já existe antes de continuar.");
    await api("/api/recover-post", {
      id: el.dataset.id,
      checked_linkedin: true,
    });
    close();
    await refresh();
    toast("Rascunho recuperado.");
  },
  backup: async () => {
    const result = await api("/api/backup");
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "auto-linkedim-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  "restore-modal": () =>
    modal(
      "Restaurar backup",
      `<form id="restore-form"><div class="dialog-content"><div class="notice warn">A restauração substitui o perfil e todo o histórico atual. Uma cópia de segurança é criada na pasta backups antes da troca. Agendamentos restaurados voltam para rascunho.</div><div class="field"><label for="backup-file">Arquivo JSON exportado pelo aplicativo</label><input type="file" id="backup-file" accept="application/json,.json" required></div><label class="check"><input name="approved" type="checkbox" required>Entendo que meus dados atuais serão substituídos.</label></div><div class="dialog-footer"><button type="submit" class="primary">Restaurar dados</button></div></form>`,
    ),
};
document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.nav);
    return;
  }
  const el = event.target.closest("[data-action]");
  if (!el) return;
  event.preventDefault();
  if (el.disabled) return;
  el.disabled = true;
  try {
    await actions[el.dataset.action]?.(el);
  } catch (error) {
    toast(error.message, true);
  } finally {
    el.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  if (["job-search", "job-filter"].includes(event.target.id)) filterJobs();
  if (event.target.classList.contains("post-text")) {
    const card = event.target.closest("[data-post]");
    card.querySelector(".post-count").textContent =
      event.target.value.length + "/3.000 caracteres";
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "job-filter") filterJobs();
});
function filterJobs() {
  const q = document
      .querySelector("#job-search")
      .value.toLocaleLowerCase("pt-BR"),
    status = document.querySelector("#job-filter").value;
  document.querySelectorAll("tr[data-job-id]").forEach((row) => {
    const j = byID("jobs", row.dataset.jobId);
    row.hidden = !(
      (j.title + " " + j.company).toLocaleLowerCase("pt-BR").includes(q) &&
      (!status || j.status === status)
    );
  });
}
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const submit =
    form.querySelector('[type="submit"]') ||
    document.querySelector(`[form="${form.id}"]`);
  if (submit) submit.disabled = true;
  try {
    if (form.id === "profile-form") {
      await api("/api/profile", { ...state.profile, ...data });
      await refresh();
      toast("Perfil salvo.");
    } else if (form.id === "attachment-form") {
      const file = document.querySelector("#attachment-file").files[0];
      if (!file || file.size > 5000000)
        throw new Error("Escolha um PDF de até 5 MB.");
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () =>
          reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      await api("/api/attach-cv", {
        job_id: data.job_id,
        filename: file.name,
        content,
        sent_at: data.sent_at
          ? new Date(data.sent_at + "T12:00:00").toISOString()
          : "",
        notes: data["attachment-notes"],
        mark_sent: form.elements.mark_sent.checked,
      });
      close();
      await refresh();
      toast("PDF original guardado no histórico.");
    } else if (form.id === "provider-form") {
      await api("/api/ai-provider", data);
      await refresh();
      toast("Provedor de geração atualizado.");
    } else if (form.id === "model-form") {
      if (!data.model)
        throw new Error("Carregue e selecione um modelo da lista.");
      await api("/api/chatgpt-model", data);
      await refresh();
      toast("Modelo do ChatGPT selecionado.");
    } else if (form.id === "entry-form") {
      const old =
        state.profile.entries.find((e) => e.id === form.dataset.id) || {};
      const item = {
        ...old,
        ...data,
        id: form.dataset.id,
        confirmed: form.elements.confirmed.checked,
        skills: data.skills
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
      const entries = state.profile.entries
        .filter((e) => e.id !== item.id)
        .concat(item);
      await api("/api/profile", { ...state.profile, entries });
      close();
      await refresh();
      toast("Evidência salva.");
    } else if (form.id === "job-form") {
      const j = await api("/api/jobs", {
        ...data,
        requirements: readReqs(form),
      });
      close();
      selectedJob = j.id;
      screen = "job";
      assessment = null;
      await refresh();
      toast("Vaga adicionada.");
    } else if (form.id === "status-form") {
      await api("/api/job-status", { ...data, id: form.dataset.id });
      await refresh();
      toast("Acompanhamento atualizado.");
    } else if (form.id === "github-form") {
      const r = await api("/api/import-github", data);
      close();
      screen = "profile";
      await refresh();
      toast(`${r.added} projetos importados para revisão.`);
    } else if (form.id === "linkedin-form") {
      await api("/api/import-linkedin", data);
      close();
      screen = "profile";
      await refresh();
      toast("Texto importado para revisão.");
    } else if (form.id === "draft-form") {
      toast(
        state.settings.ai_provider !== "template"
          ? "A IA está preparando o texto…"
          : "Preparando rascunho…",
      );
      await api("/api/draft", data);
      close();
      screen = "posts";
      await refresh();
      toast("Rascunho criado. Revise antes de publicar.");
    } else if (form.id === "schedule-form") {
      if (!data.scheduled_at) throw new Error("Escolha uma data e um horário.");
      await api("/api/schedule", {
        id: form.dataset.id,
        scheduled_at: new Date(data.scheduled_at).toISOString(),
        confirmed: form.elements.approved.checked,
      });
      close();
      await refresh();
      toast("Postagem agendada neste computador.");
    } else if (form.id === "resume-copy-form") {
      await api("/api/resume-copy", {
        id: form.dataset.id,
        summary: data["resume-summary"],
        entry_ids: new FormData(form).getAll("entry_id"),
      });
      close();
      await refresh();
      toast("Nova versão preservada no histórico.");
    } else if (form.id === "restore-form") {
      const file = document.querySelector("#backup-file").files[0];
      if (!file || file.size > 100000000)
        throw new Error("Escolha um backup de até 100 MB.");
      await api("/api/restore", JSON.parse(await file.text()));
      close();
      await refresh();
      toast("Backup restaurado.");
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
});
refresh()
  .then(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected")) {
      screen = "settings";
      render();
      history.replaceState({}, "", location.pathname);
    }
    if (params.get("connected") === "chatgpt")
      modal(
        "Seu plano ChatGPT está conectado",
        `<div class="dialog-content"><p>As solicitações de IA elegíveis usam os limites do seu plano ChatGPT. Você pode gerenciar o uso e revogar a conexão nas configurações do ChatGPT.</p><p class="hint">Agora carregue os modelos, escolha um deles e selecione ChatGPT como provedor. O conteúdo usado para gerar textos será enviado à OpenAI quando você solicitar a geração.</p></div><div class="dialog-footer"><button class="primary" data-action="close">Entendi</button></div>`,
      );
  })
  .catch((error) => {
    app.innerHTML = empty(
      "Não foi possível abrir o aplicativo",
      error.message,
      null,
    );
  });
