const TONE: Record<string, string> = {
  AVAILABLE: "ok", ACCEPTED: "ok", ACTIVE: "ok",
  PENDING: "warn", OCCUPIED: "warn",
  REJECTED: "danger", WITHDRAWN: "", HIDDEN: "", ENDED: "",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${TONE[status] ?? ""}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}
