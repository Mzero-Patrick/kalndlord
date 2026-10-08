import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DASHBOARD_PATH, ISSUE_KIND_LABEL, ISSUE_STATUS_LABEL, type Issue } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { IssueStatusBadge } from "@/components/IssuesPanel";
import { IssueUpdateForm } from "@/components/IssueForms";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const res = await api<{ issue: Issue }>(`/issues/${id}`);
  if (!res.ok) notFound();
  const i = res.data.issue;
  const canManage = user.role !== "TENANT";
  const contact = canManage ? [i.tenant.phone, i.tenant.email].filter(Boolean).join(" · ") : null;
  return (
    <main className="container stack" style={{ maxWidth: 760 }}>
      <Link href={DASHBOARD_PATH[user.role]}>← Back to dashboard</Link>
      <div className="card stack">
        <div className="row between">
          <h1 style={{ margin: 0 }}>{i.subject}</h1>
          <div className="row">
            {i.urgent && i.status !== "DONE" && <span className="badge danger">Urgent</span>}
            <IssueStatusBadge status={i.status} />
          </div>
        </div>
        <div className="hint">
          {ISSUE_KIND_LABEL[i.kind]} · {i.property.title} · reported by {i.tenant.fullName} on {when(i.createdAt)}
          {contact && <> · {contact}</>}
        </div>
        <p className="quote">{i.message}</p>
        {i.photos.length > 0 && (
          <div className="gallery">
            {i.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="Photo of the problem" /></a>
            ))}
          </div>
        )}
      </div>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Updates</h2>
        {i.updates.length === 0 ? (
          <p className="muted">{canManage ? "No updates yet. Let the tenant know what happens next." : "No updates yet. Your landlord has been told."}</p>
        ) : (
          <div className="list">
            {i.updates.map((u) => (
              <div key={u.id} className="stack" style={{ gap: 4 }}>
                <div className="row between">
                  <strong>{u.author.fullName}{u.author.role === "ADMIN" ? " (administrator)" : ""}</strong>
                  <span className="hint">{when(u.createdAt)}</span>
                </div>
                {u.status && <span className="hint">Marked “{ISSUE_STATUS_LABEL[u.status]}”</span>}
                {u.message && <p className="quote">{u.message}</p>}
              </div>
            ))}
          </div>
        )}
        {/* Remount after each update so the status choice matches the saved one. */}
        <IssueUpdateForm key={i.updates.length} id={i.id} status={i.status} canManage={canManage} />
      </section>
    </main>
  );
}
