/**
 * Evaluates the comparison plan against the research doc's acceptance checks
 * on representative and deliberately awkward fixtures.
 *
 *   npm run eval            rules engine only (free, deterministic)
 *   npm run eval -- --ai    also asks Claude (needs ANTHROPIC_API_KEY; costs API credits)
 *
 * Writes a Markdown report to eval-results/.
 */
import fs from "node:fs";
import path from "node:path";
import { analyzeComparison, type ComparisonAnalysis } from "../src/lib/compare/analyze";
import { FIXTURES, type Fixture } from "../src/lib/compare/fixtures";
import { hasUnsupportedClaim, inventedFacts, validatePlan, verifyEvidence } from "../src/lib/compare/guard";
import { rulesPlan, type Plan } from "../src/lib/compare/plan";

try {
  process.loadEnvFile(".env");
} catch {
  // optional
}

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

function planText(p: Plan): string {
  return [p.summary, ...p.suggestions.flatMap((s) => [s.action, s.why, s.proposedText ?? "", s.needsSellerInput ?? ""]), ...p.missingInfo].join("\n");
}

function checkPlan(p: Plan, a: ComparisonAnalysis, f: Fixture): CheckResult[] {
  const text = planText(p);
  const claim = hasUnsupportedClaim(text);
  const badEvidence = p.suggestions.flatMap((s) => s.evidence.filter((e) => !verifyEvidence(e, a).ok).map((e) => e.ref));
  const invented = p.suggestions.flatMap((s) => (s.proposedText ? inventedFacts(s.proposedText, a) : []));
  const forbidden = f.forbidden.filter((re) => re.test(text)).map(String);
  const unknownRefs = p.suggestions.flatMap((s) => s.evidence.filter((e) => verifyEvidence(e, a).reason?.includes("unknown")).map((e) => e.ref));
  return [
    { name: "No sales/ranking claims", pass: !claim, detail: claim ? `found "${claim}"` : "none" },
    { name: "Evidence quotes verified", pass: badEvidence.length === 0, detail: badEvidence.length ? badEvidence.join(", ") : `${p.suggestions.reduce((n, s) => n + s.evidence.length, 0)} quotes` },
    { name: "No invented product facts", pass: invented.length === 0, detail: invented.length ? invented.join(", ") : "none" },
    { name: "Forbidden content absent", pass: forbidden.length === 0, detail: forbidden.length ? forbidden.join(", ") : "ok" },
    { name: "Unknown fields not cited", pass: unknownRefs.length === 0, detail: unknownRefs.length ? unknownRefs.join(", ") : "ok" },
    { name: "At least one suggestion", pass: p.suggestions.length > 0, detail: `${p.suggestions.length}` },
  ];
}

function checkAnalysis(a: ComparisonAnalysis, f: Fixture): CheckResult[] {
  const out: CheckResult[] = [];
  if (f.id === "mixed-currency") {
    out.push({ name: "Prices not compared across currencies", pass: a.price.position === "no-comparison" && a.price.comparable.length === 0, detail: `position=${a.price.position}` });
  }
  if (f.id === "incomplete") {
    const unknown = Object.values(a.attributes.mine!).every((r) => r.status !== "not_stated");
    out.push({ name: "Missing facts stay unknown", pass: unknown, detail: unknown ? "no attribute marked 'not stated' without a description" : "an attribute was marked missing" });
  }
  if (f.id === "injection" || f.id === "representative") {
    const flagged = a.findings.filter((x) => x.area === "safety").length;
    out.push({ name: "Instruction-like text flagged", pass: flagged > 0, detail: `${flagged} listing(s) flagged` });
  }
  return out;
}

async function main() {
  const useAi = process.argv.includes("--ai");
  if (useAi && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("--ai needs ANTHROPIC_API_KEY (in the environment or .env).");
    process.exit(1);
  }
  const generateAiPlan = useAi ? (await import("../server/compare")).generateAiPlan : null;

  const lines: string[] = [`# Comparison plan evaluation — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, ""];
  let failures = 0;
  const stats: string[] = [];

  for (const f of FIXTURES) {
    const a = analyzeComparison(f.listings);
    lines.push(`## ${f.name} (\`${f.id}\`)`, "", f.purpose, "");
    const sections: { label: string; plan: Plan | null; error?: string }[] = [
      { label: "Rules engine", plan: validatePlan(rulesPlan(a), a, { source: "rules", model: null }) },
    ];
    if (generateAiPlan) {
      try {
        sections.push({ label: "AI", plan: await generateAiPlan(f.listings) });
      } catch (e) {
        sections.push({ label: "AI", plan: null, error: (e as Error).message });
      }
    }

    const analysisChecks = checkAnalysis(a, f);
    for (const c of analysisChecks) {
      lines.push(`- ${c.pass ? "✅" : "❌"} ${c.name} — ${c.detail}`);
      if (!c.pass) failures++;
    }
    lines.push("");

    for (const s of sections) {
      lines.push(`### ${s.label}`, "");
      if (!s.plan) {
        lines.push(`- ❌ No plan: ${s.error}`, "");
        failures++;
        continue;
      }
      for (const c of checkPlan(s.plan, a, f)) {
        lines.push(`- ${c.pass ? "✅" : "❌"} ${c.name} — ${c.detail}`);
        if (!c.pass) failures++;
      }
      const notes = s.plan.suggestions.reduce((n, x) => n + x.notes.length, 0);
      lines.push(`- Suggestions kept: ${s.plan.suggestions.length} · removed by guard: ${s.plan.rejected.length} · wording/evidence fixed by guard: ${notes}`);
      for (const r of s.plan.rejected) lines.push(`  - Removed: ${r.action} — ${r.reasons.join("; ")}`);
      lines.push("");
      stats.push(`${f.id}/${s.label}: kept ${s.plan.suggestions.length}, removed ${s.plan.rejected.length}, fixed ${notes}`);
    }
  }

  lines.splice(2, 0, failures ? `**${failures} check(s) failed.**` : "**All checks passed.**", "");
  const outDir = path.resolve("eval-results");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `compare-${useAi ? "ai" : "rules"}-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(file, lines.join("\n"));
  console.log(stats.join("\n"));
  console.log(`\n${failures ? `${failures} check(s) failed` : "All checks passed"} — report: ${path.relative(process.cwd(), file)}`);
  process.exit(failures ? 1 : 0);
}

void main();
