// Knight FM — account lifecycle & season anchor (PT).

export const dict: Record<string, string> = {
  // ── Season anchor (world clock) ─────────────────────────────────
  "lifecycle.season.title": "Início do mundo (âncora da 1ª temporada)",
  "lifecycle.season.desc":
    "O dia 1 do mundo começa nesta data UTC. Definir a âncora redefine o contador de dias de jogo: use apenas para corrigir o início da 1ª temporada.",
  "lifecycle.season.currentAnchor": "Âncora atual (UTC)",
  "lifecycle.season.gameDay": "Dia de jogo atual",
  "lifecycle.season.activeSeason": "Temporada ativa",
  "lifecycle.season.seasonN": "Temporada {n}",
  "lifecycle.season.none": "Sem temporada ativa",
  "lifecycle.season.dateLabel": "Nova data de início (UTC)",
  "lifecycle.season.setButton": "Definir início da 1ª temporada",
  "lifecycle.season.setDone": "Mundo ancorado em {date}. Dia de jogo atual: {day}.",
  "lifecycle.season.forceTitle": "Re-ancorar o mundo?",
  "lifecycle.season.forceDesc":
    "Já existem temporadas. Re-ancorar reinicia o contador de dias do mundo e remapeia a temporada em curso, os calendários e os contratos. A ação fica registrada na auditoria.",
  "lifecycle.season.forceCheck": "Entendi, re-ancorar",
  "lifecycle.season.forceConfirm": "Re-ancorar o mundo",
  "lifecycle.season.error": "Não foi possível definir a âncora do mundo",

  // ── Inactivity policy ──────────────────────────────────────────
  "lifecycle.inactivity.title": "Ciclo de vida das contas",
  "lifecycle.inactivity.desc":
    "Tarefa diária (00:20 UTC): contas sem acessos são marcadas como INATIVAS e depois depuradas. Os clubes de proprietários excluídos voltam ao sistema com o nome original; os clubes dirigidos perdem o técnico e o contrato é encerrado.",
  "lifecycle.inactivity.policy":
    "Contas: INATIVA após {a} dias, excluída após {b} — os administradores nunca expiram.",
  "lifecycle.inactivity.policyUnknown":
    "Contas sem atividade são marcadas como INATIVAS e depois excluídas; os administradores nunca expiram.",
};
