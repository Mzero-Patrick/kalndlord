import Link from "next/link";
import { ISSUE_KIND_LABEL, ISSUE_STATUS_LABEL, type Issue, type IssueStatus } from "@kalndlord/shared";

const TONE: Record<IssueStatus, string> = { OPEN: "danger", IN_PROGRESS: "warn", DONE: "ok" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`badge ${TONE[status]}`}>{ISSUE_STATUS_LABEL[status]}</span>;
}

// Reports, unfinished first. Each opens a page with photos and the conversation.
export function IssuesPanel({ items, viewer, empty }: { items: Issue[]; viewer: "TENANT" | "LANDLORD" | "ADMIN"; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  const rank = (i: Issue) => (i.status === "DONE" ? 2 : i.urgent ? 0 : 1);
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Reported</th><th>Subject</th>{viewer !== "TENANT" && <th>Tenant</th>}<th>Place</th><th>Status</th></tr>
        </thead>
        <tbody>
          {sorted.map((i) => (
            <tr key={i.id}>
              <td>{day(i.createdAt)}</td>
              <td>
                <Link href={`/issues/${i.id}`}>{i.subject}</Link>
                <div className="hint">
                  {ISSUE_KIND_LABEL[i.kind]}
                  {i.photos.length > 0 && ` · ${i.photos.length} photo${i.photos.length > 1 ? "s" : ""}`}
                  {i.updates.length > 0 && ` · ${i.updates.length} update${i.updates.length > 1 ? "s" : ""}`}
                </div>
              </td>
              {viewer !== "TENANT" && <td>{i.tenant.fullName}</td>}
              <td>{i.property.title}</td>
              <td>
                {i.urgent && i.status !== "DONE" && <span className="badge danger" style={{ marginRight: 6 }}>Urgent</span>}
                <IssueStatusBadge status={i.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
