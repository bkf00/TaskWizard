import { store } from "@repo/storage/local-store";
import { filterVisibleTasks } from "@repo/domain/privacy";
import { getCurrentActor } from "../auth-actor";
import { EmailSourceForm } from "./email-source-form";
import { LiveDashboardRefresh } from "./live-dashboard-refresh";
import { getDashboardStateVersion } from "./state-version";
import { TaskHistoryPanel } from "./task-history-panel";

export const dynamic = "force-dynamic";

const plannerTerminalSourceStatuses = new Set(["approved", "created_in_planner", "planner_sync_failed"]);

function formatDate(value: string | null): string {
  if (!value) return "fara termen";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(value));
}

export default async function HomePage() {
  const actor = await getCurrentActor();
  const [tasks, errors, auditEvents, stateVersion] = await Promise.all([
    store.listProposedTasks(),
    store.listProcessingErrors(),
    store.listAuditEvents(),
    getDashboardStateVersion(actor.email)
  ]);

  const visibleTasks = filterVisibleTasks(tasks, actor.email);
  const reviewTasks = visibleTasks.filter((task) => task.status === "proposed");
  const plannerActiveTasks = visibleTasks.filter((task) => plannerTerminalSourceStatuses.has(task.status));

  return (
    <main>
      <LiveDashboardRefresh initialVersion={stateVersion.version} />
      <header className="app-header">
        <div className="brand">
          <img className="brand-mark" src="/assets/taskwizard-hat.png" alt="TaskWizard" />
          <div>
            <h1>TaskWizard</h1>
            <p className="muted">Inbox de verificare pentru taskuri extrase din emailuri si minute.</p>
            <p className="muted actor-line">
              Actor: {actor.name ? `${actor.name} / ` : ""}
              {actor.email}
            </p>
          </div>
        </div>
        <div>
          <div className="top-actions">
            <a className="button-link" href="/tasks">
              View taskuri
            </a>
            <EmailSourceForm defaultActorEmail={actor.email} authenticated={actor.authenticated} />
          </div>
          <div className="summary">
            <div className="metric">
              <strong>{reviewTasks.length}</strong>
              <span>de verificat</span>
            </div>
            <div className="metric">
              <strong>{visibleTasks.length}</strong>
              <span>total taskuri</span>
            </div>
            <div className="metric">
              <strong>{errors.length}</strong>
              <span>erori</span>
            </div>
          </div>
        </div>
      </header>

      <div className="workspace">
        <section className="panel">
          <div className="review-heading">
            <div>
              <h2>Review taskuri</h2>
              <p className="muted">Verifica titlul, responsabilul si dovada inainte de aprobare.</p>
            </div>
            <span className="badge proposed">{reviewTasks.length} active</span>
          </div>

          <div className="task-list review-scroll">
            {reviewTasks.length === 0 ? (
              <div className="empty">Nu exista taskuri de verificat.</div>
            ) : (
              reviewTasks.map((task) => (
                <article className="task-card" data-status={task.status} key={task.id}>
                  <div className="task-top">
                    <div className="task-title">{task.title}</div>
                    <span className={`badge ${task.status}`}>{task.status}</span>
                  </div>
                  <div className="meta">
                    <span className="badge">{task.assigneeName ?? task.assigneeEmail ?? "fara responsabil"}</span>
                    <span className="badge">{formatDate(task.dueDate)}</span>
                    {task.priority === "high" ? <span className="badge high-priority">prioritar</span> : null}
                    <span className="badge">confidence: {task.confidence}</span>
                  </div>
                  <div className="evidence">{task.evidence}</div>
                  {task.description ? <p className="source">{task.description}</p> : null}

                  <details className="edit">
                    <summary>Editeaza taskul</summary>
                    <form action={`/api/tasks/${task.id}/update`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <label htmlFor={`title-${task.id}`}>Titlu</label>
                      <input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
                      <label htmlFor={`description-${task.id}`}>Descriere</label>
                      <textarea id={`description-${task.id}`} name="description" defaultValue={task.description ?? ""} />
                      <div className="compact">
                        <div>
                          <label htmlFor={`assignee-${task.id}`}>Responsabil</label>
                          <input
                            id={`assignee-${task.id}`}
                            name="assigneeName"
                            defaultValue={task.assigneeName ?? task.assigneeEmail ?? ""}
                          />
                        </div>
                        <div>
                          <label htmlFor={`due-${task.id}`}>Termen</label>
                          <input id={`due-${task.id}`} name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
                        </div>
                      </div>
                      <label htmlFor={`project-${task.id}`}>Proiect</label>
                      <input id={`project-${task.id}`} name="projectHint" defaultValue={task.projectHint ?? ""} />
                      <div className="actions">
                        <button className="button-muted" type="submit">
                          Salveaza editarea
                        </button>
                      </div>
                    </form>
                  </details>

                  <div className="actions">
                    <form action={`/api/tasks/${task.id}/approve`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <button type="submit">Aproba</button>
                    </form>
                    <form action={`/api/tasks/${task.id}/approve`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <input type="hidden" name="priority" value="high" />
                      <button className="button-priority" type="submit">
                        Aproba prioritar
                      </button>
                    </form>
                    <form action={`/api/tasks/${task.id}/reject`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <button className="danger" type="submit">
                        Respinge
                      </button>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="review-heading section-gap">
            <div>
              <h2>Taskuri active / aprobate</h2>
              <p className="muted">Aici apar butoanele de terminare sau stergere dupa aprobare.</p>
            </div>
            <span className="badge approved">{plannerActiveTasks.length} active</span>
          </div>

          <div className="task-list review-scroll">
            {plannerActiveTasks.length === 0 ? (
              <div className="empty">Nu exista taskuri aprobate. Aproba un task propus, apoi apar aici actiunile.</div>
            ) : (
              plannerActiveTasks.map((task) => (
                <article className="task-card" data-status={task.status} key={task.id}>
                  <div className="task-top">
                    <div className="task-title">{task.title}</div>
                    <span className={`badge ${task.status}`}>{task.status}</span>
                  </div>
                  <div className="meta">
                    <span className="badge">{task.assigneeName ?? task.assigneeEmail ?? "fara responsabil"}</span>
                    <span className="badge">{formatDate(task.dueDate)}</span>
                    {task.plannerTaskId ? <span className="badge">Planner: {task.plannerTaskId}</span> : null}
                  </div>
                  {task.description ? <div className="evidence">{task.description}</div> : null}
                  <div className="actions">
                    <form action={`/api/tasks/${task.id}/complete`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <button className="button-muted" type="submit">
                        Marcheaza terminat
                      </button>
                    </form>
                    <form action={`/api/tasks/${task.id}/delete`} method="post">
                      <input type="hidden" name="actorEmail" value={actor.email} />
                      <button className="danger" type="submit">
                        Marcheaza sters
                      </button>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="drawer">
          <TaskHistoryPanel tasks={visibleTasks} actorEmail={actor.email} />

          <section className="panel">
            <h2>Erori procesare</h2>
            {errors.length === 0 ? (
              <div className="empty">Nu exista erori.</div>
            ) : (
              errors.slice(0, 5).map((error) => (
                <div className="event" key={error.id}>
                  <strong className="error-text">{error.stage}</strong>
                  <br />
                  {error.message}
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <h2>Audit recent</h2>
            {auditEvents.length === 0 ? (
              <div className="empty">Nu exista evenimente inca.</div>
            ) : (
              auditEvents.slice(0, 8).map((event) => (
                <div className="event" key={event.id}>
                  <strong>{event.type}</strong>
                  <br />
                  <span className="muted">{event.message}</span>
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
