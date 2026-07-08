import { CHECK_RULES } from "./report-rules.js"
import type { PulseAction, PulseCheck, PulseReport, RepositorySignals } from "./types.js"

export function buildReport(signals: RepositorySignals, now: Date = new Date()): PulseReport {
  const checks = CHECK_RULES.map((rule): PulseCheck => {
    const passed = rule.passed(signals)

    return {
      detail: rule.detail(signals),
      id: rule.id,
      label: rule.label,
      passed,
      points: passed ? rule.points : 0,
    }
  })

  const actions = CHECK_RULES.flatMap((rule): readonly PulseAction[] =>
    rule.passed(signals) || rule.action === null ? [] : [rule.action],
  )
  const score = checks.reduce((total, check) => total + check.points, 0)
  const status = actions.length === 0 ? "ready" : "needs-work"

  return {
    actions,
    branch: signals.branch,
    checks,
    generatedAtIso: now.toISOString(),
    latestCommitIso: signals.latestCommitIso,
    root: signals.root,
    score,
    status,
  }
}
