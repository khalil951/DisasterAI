"use client";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_TEXT, checkInput } from "@/lib/client";
import type { Sample } from "@/lib/types";

export interface FormState {
  text: string;
  language: "en" | "fr";
  file: File | null;
  sampleId: string | null;
  sampleImage: boolean;
}

export function IncidentForm(props: {
  value: FormState;
  onChange: (v: FormState) => void;
  samples: Sample[];
  running: boolean;
  onSubmit: () => void;
}) {
  const { value, onChange, samples, running } = props;
  const [drag, setDrag] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const imgSrc = preview ?? (value.sampleImage && value.sampleId ? `/api/samples/${value.sampleId}/image` : null);
  const hasImage = Boolean(imgSrc);
  const problems = checkInput(value.text, value.file ? { size: value.file.size, type: value.file.type } : undefined);
  const blocked = problems.length > 0;
  const featured = samples.filter((s) => s.featured);
  const more = samples.filter((s) => !s.featured);

  function pick(s: Sample) {
    onChange({ text: s.text, language: s.language, file: null, sampleId: s.id, sampleImage: s.hasImage });
  }
  function setFile(f: File | null) {
    onChange({ ...value, file: f, sampleImage: f ? false : value.sampleImage });
  }

  return (
    <form
      className="card space-y-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked && !running) props.onSubmit();
      }}
    >
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="incident" className="font-semibold">
            Describe the incident
          </label>
          <div role="group" aria-label="Report language" className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={value.language === l}
                onClick={() => onChange({ ...value, language: l })}
                className={`px-3 py-1.5 font-semibold ${value.language === l ? "bg-accent text-accent-contrast" : "bg-surface text-muted hover:bg-surface-2"}`}
                title={l === "en" ? "Write the report in English" : "Rédiger le rapport en français"}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="incident"
          rows={5}
          value={value.text}
          maxLength={MAX_TEXT + 200}
          disabled={running}
          placeholder="What was seen or reported, where, and when? For example: smoke is rising from the hills behind the village and the wind is picking up."
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !blocked && !running) props.onSubmit();
          }}
          className="w-full resize-y rounded-xl border border-border bg-surface-2 p-3 text-[15px] leading-relaxed placeholder:text-muted/70"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Report language: {value.language === "en" ? "English" : "Français"}</span>
          <span>
            {value.text.length} / {MAX_TEXT}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {featured.map((s) => (
            <button key={s.id} type="button" className="chip" disabled={running} onClick={() => pick(s)} aria-pressed={value.sampleId === s.id}>
              {s.label}
            </button>
          ))}
          {more.length > 0 && (
            <button type="button" className="chip" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              {showMore ? "Fewer photos" : `${more.length} more with photos`}
            </button>
          )}
        </div>
        {showMore && (
          <div className="mt-2 flex flex-wrap gap-2">
            {more.map((s) => (
              <button key={s.id} type="button" className="chip" disabled={running} onClick={() => pick(s)} aria-pressed={value.sampleId === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Photo <span className="font-normal text-muted">(optional)</span>
        </p>
        {hasImage ? (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgSrc as string} alt="The photo that will be analysed" className="h-20 w-28 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{value.file?.name ?? "Example photo"}</p>
              {value.file && <p className="text-xs text-muted">{(value.file.size / 1024).toFixed(0)} KB</p>}
            </div>
            <button type="button" className="btn btn-ghost !p-2" disabled={running} onClick={() => onChange({ ...value, file: null, sampleImage: false })} aria-label="Remove the photo">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={running}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm transition-colors ${drag ? "border-accent bg-surface-2" : "border-border hover:bg-surface-2"}`}
          >
            <ImagePlus size={22} className="text-muted" />
            <span className="font-medium">Drop a photo here or click to choose</span>
            <span className="text-xs text-muted">PNG, JPEG or WebP, up to 8 MB</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary !px-5 !py-2.5" disabled={blocked || running}>
          {running ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {running ? "Assessing…" : "Assess incident"}
        </button>
        <span className="text-xs text-muted">{blocked && value.text.length > 0 ? problems[0] : blocked ? "Describe the incident to begin." : "Ctrl+Enter also works."}</span>
      </div>
    </form>
  );
}
