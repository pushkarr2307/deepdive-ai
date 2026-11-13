export const STAGES = [
  { key: "queued", label: "Queued" },
  { key: "downloading", label: "Fetching" },
  { key: "transcribing", label: "Transcribing" },
  { key: "generating", label: "Writing notes" },
  { key: "indexing", label: "Indexing" },
  { key: "ready", label: "Ready" },
];

export const inProgress = (s) => s && s !== "ready" && s !== "failed";

export default function StatusPill({ status }) {
  const label = STAGES.find((s) => s.key === status)?.label || (status === "failed" ? "Failed" : status);
  const style =
    status === "ready"
      ? "bg-moss/10 text-moss border-moss/30"
      : status === "failed"
      ? "bg-accent/10 text-accent border-accent/30"
      : "bg-ink/5 text-ink border-line";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {inProgress(status) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {label}
    </span>
  );
}
