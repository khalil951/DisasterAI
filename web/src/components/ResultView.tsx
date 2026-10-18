"use client";
import { Check, Clipboard, Download, FilePlus2, Printer } from "lucide-react";
import { useState } from "react";
import { degradedLines, imageMessage, incidentTypeLabel, repairDiscardedProblems, slowestStep, statusBanner, timelineRows, validationView } from "@/lib/render";
import type { Report, RunBody, Sourced } from "@/lib/types";
import { EntryButton, Notice, SeverityBadge, SourceChip } from "./Bits";

function SourcedList({ items }: { items?: Sourced[] }) {
  if (!items?.length) return <p className="text-sm text-muted">Nothing reported.</p>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
          <span>{it.text}</span>
          <SourceChip source={it.source} />
          {it.confidence && <span className="text-[11px] text-muted">{it.confidence} confidence</span>}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function StringList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-muted">None.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-[15px]">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function ReportTab({ report }: { report: Report }) {
  const recs = report.recommendations ?? [];
  return (
    <div className="space-y-6">
      {report.summary && <p className="text-lg leading-relaxed">{report.summary}</p>}
      <Section title="What was reported">
        <SourcedList items={report.reported} />
      </Section>
      <Section title="Assessment">
        {(report.assessment?.conflicts ?? []).map((c, i) => (
          <div key={i} className="mb-3">
            <Notice level="warning" title="Conflicting information">
              {c}
            </Notice>
          </div>
        ))}
        <p className="mb-1 text-sm font-medium">Basis</p>
        <SourcedList items={report.assessment?.basis} />
        <p className="mb-1 mt-4 text-sm font-medium">Risks</p>
        <SourcedList items={report.assessment?.risks} />
        {(report.assessment?.possibly_affected?.length ?? 0) > 0 && (
          <>
            <p className="mb-1 mt-4 text-sm font-medium">Possibly affected</p>
            <SourcedList items={report.assessment?.possibly_affected} />
          </>
        )}
      </Section>
      <Section title="Recommended actions">
        {recs.length === 0 ? (
          <p className="text-sm text-muted">{report.knowledge?.no_guidance_statement ?? "No guidance from the knowledge base applies to this report."}</p>
        ) : (
          <ol className="space-y-3">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                <div className="min-w-0 text-[15px]">
                  <p>
                    {r.text} <SourceChip source={r.source} />
                  </p>
                  {r.entry_id && <EntryButton id={r.entry_id} />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Uncertainties">
          <StringList items={report.uncertainties} />
        </Section>
        <Section title="Information needed">
          <StringList items={report.information_needed} />
        </Section>
      </div>
    </div>
  );
}

function ImageTab({ report, src, sent }: { report: Report; src: string | null; sent: boolean }) {
  const m = imageMessage(report, sent);
  return (
    <div className="space-y-4">
      <Notice level={m.level} title={m.text} />
      <div className="grid gap-5 md:grid-cols-2">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="The photo submitted with the report" className="max-h-96 w-full rounded-xl border border-border object-contain" />
        )}
        <div className="space-y-5">
          <Section title="What the photo shows">
            <SourcedList items={report.observed} />
          </Section>
          <Section title="Photo versus report">
            {(report.assessment?.conflicts ?? []).length ? <StringList items={report.assessment?.conflicts} /> : <p className="text-sm text-muted">No conflict between the photo and the report was found.</p>}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Technical({ body }: { body: RunBody }) {
  const rows = timelineRows(body.models_used);
  const slow = slowestStep(rows);
  const v = validationView(body.validation);
  const discarded = repairDiscardedProblems(body.validation);
  const degraded = degradedLines(body.degraded_steps);
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold sm:px-6">
        Technical details <span className="ml-2 text-sm font-normal text-muted group-open:hidden">pipeline, checks, sources, raw data</span>
      </summary>
      <div className="space-y-6 border-t border-border p-5 text-sm sm:p-6">
        <Section title="Pipeline">
          {rows.length === 0 ? (
            <p className="text-muted">No step information in this answer.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1 pr-3">Step</th>
                    <th className="pr-3">Provider</th>
                    <th className="pr-3">Model</th>
                    <th className="pr-3 text-right">Seconds</th>
                    <th>Fallbacks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5 pr-3 font-medium">{r.step}{slow === r && rows.length > 1 ? " (slowest)" : ""}</td>
                      <td className="pr-3">{r.provider}</td>
                      <td className="pr-3">{r.model}</td>
                      <td className="pr-3 text-right tabular-nums">{r.seconds.toFixed(1)}</td>
                      <td title={r.failedDetail}>{r.failedAttempts || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        {degraded.length > 0 && (
          <Section title="Degraded steps">
            <StringList items={degraded} />
          </Section>
        )}
        <Section title="Safety checks">
          <p>
            Status: <strong>{v.status}</strong>
            {v.repaired ? " (a repair pass was run)" : ""}
          </p>
          {v.now.length > 0 && <StringList items={v.now.map((x) => `${x.check}: ${x.message}`)} />}
          {v.first.length > 0 && (
            <>
              <p className="mt-2 font-medium">Problems found before the repair</p>
              <StringList items={v.first.map((x) => `${x.check}: ${x.message}`)} />
            </>
          )}
          {discarded.length > 0 && (
            <>
              <p className="mt-2 font-medium">What the discarded repair got wrong</p>
              <StringList items={discarded.map((x) => `${x.check}: ${x.message}`)} />
            </>
          )}
        </Section>
        <Section title="Knowledge used">
          <p>
            Coverage: <strong>{body.knowledge_coverage ?? "-"}</strong>
          </p>
          <p className="mt-1 break-words text-muted">{(body.retrieved_entry_ids ?? []).join(", ") || "No entries retrieved."}</p>
        </Section>
        <Section title="Prompt versions">
          <p className="text-muted">{Object.entries(body.prompt_versions ?? {}).map(([k, val]) => `${k} ${val}`).join(", ") || "-"}</p>
        </Section>
        <Section title="Raw answer">
          <pre className="max-h-96 overflow-auto rounded-lg bg-surface-2 p-3 text-xs">{JSON.stringify(body, null, 2)}</pre>
        </Section>
      </div>
    </details>
  );
}

export function ResultView(props: { body: RunBody; seconds: number; demo: boolean; imageSrc: string | null; sentImage: boolean; onNew: () => void }) {
  const { body } = props;
  const [tab, setTab] = useState<"report" | "image">("report");
  const [copied, setCopied] = useState(false);
  const banner = statusBanner(body);
  const report = body.report ?? null;
  const markdown = body.report_markdown ?? report?.report_markdown ?? "";
  const severity = body.severity ?? report?.severity;

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the download still works */
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "disasterai-report.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rise space-y-4">
      {props.demo && (
        <Notice level="info" title="Demo data">
          This answer was replayed from a saved run. It was not produced live.
        </Notice>
      )}
      <Notice level={banner.level} title={banner.title}>
        {banner.message}
      </Notice>

      <section className="card p-5 sm:p-6" aria-label="Summary">
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={severity} large />
          <span className="text-lg font-semibold">{incidentTypeLabel(body.incident_type)}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Location</dt>
            <dd className="font-medium">{report?.location || "Not stated"}</dd>
          </div>
          <div>
            <dt className="text-muted">Guidance coverage</dt>
            <dd className="font-medium capitalize">{body.knowledge_coverage ?? report?.knowledge?.coverage ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted">Photo</dt>
            <dd className="font-medium">{imageMessage(report, props.sentImage).status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-muted">Run time</dt>
            <dd className="font-medium tabular-nums">{props.seconds.toFixed(1)} s</dd>
          </div>
        </dl>
      </section>

      {report && (
        <section className="card p-5 sm:p-6">
          <div role="tablist" aria-label="Report sections" className="no-print mb-5 flex gap-1 border-b border-border">
            {(
              [
                ["report", "Report"],
                ["image", "Image and report"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-text"}`}>
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">{tab === "report" ? <ReportTab report={report} /> : <ImageTab report={report} src={props.imageSrc} sent={props.sentImage} />}</div>
          {report.disclaimer && <p className="mt-6 border-t border-border pt-4 text-xs text-muted">{report.disclaimer}</p>}
        </section>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={copy} disabled={!markdown}>
          {copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "Copied" : "Copy report"}
        </button>
        <button type="button" className="btn" onClick={download} disabled={!markdown}>
          <Download size={16} /> Download Markdown
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save as PDF
        </button>
        <button type="button" className="btn btn-primary ml-auto" onClick={props.onNew}>
          <FilePlus2 size={16} /> New assessment
        </button>
      </div>

      <Technical body={body} />
    </div>
  );
}
