import { store } from "@repo/storage/local-store";

export const dynamic = "force-dynamic";
const defaultActorEmail = process.env.LOCAL_ACTOR_EMAIL ?? "approver@firma.ro";

function formatDate(value: string | null): string {
  if (!value) return "fara termen";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(value));
}

export default async function HomePage() {
  const [sources, tasks, errors, auditEvents] = await Promise.all([
    store.listSources(),
    store.listProposedTasks(),
    store.listProcessingErrors(),
    store.listAuditEvents()
  ]);

  const proposedCount = tasks.filter((task) => task.status === "proposed").length;

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Taskuri AI din Teams si emailuri</h1>
          <p className="muted">
            MVP controlat: adaugi o sursa, AI propune taskuri, omul aproba, apoi se sincronizeaza cu Planner.
          </p>
        </div>
        <div className="panel">
          <strong>{proposedCount}</strong> taskuri in asteptare
          <br />
          <span className="muted">{sources.length} surse procesate</span>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Adauga sursa</h2>
          <form action="/api/sources/manual" method="post">
            <label htmlFor="type">Tip sursa</label>
            <select id="type" name="type" defaultValue="manual_upload">
              <option value="manual_upload">Recap / text manual</option>
              <option value="email">Email copiat</option>
              <option value="teams_transcript">Transcript Teams</option>
            </select>

            <label htmlFor="subject">Subiect</label>
            <input id="subject" name="subject" placeholder="Ex: Sedinta PV lucrare X" required />

            <label htmlFor="fromEmail">Expeditor / organizator</label>
            <input id="fromEmail" name="fromEmail" type="email" placeholder="optional@firma.ro" />

            <label htmlFor="participants">Participanti</label>
            <input id="participants" name="participants" placeholder="email1@firma.ro, email2@firma.ro" />

            <label htmlFor="rawText">Text email / recap / transcript</label>
            <textarea id="rawText" name="rawText" required />

            <label htmlFor="actorEmail">Procesat de</label>
            <input id="actorEmail" name="actorEmail" type="email" placeholder="nume@firma.ro" />

            <div style={{ marginTop: 16 }}>
              <button type="submit">Extrage taskuri propuse</button>
            </div>
          </form>
        </section>

        <section className="stack">
          <div className="panel">
            <h2>Taskuri propuse</h2>
            {tasks.length === 0 ? (
              <p className="muted">Nu exista taskuri propuse inca.</p>
            ) : (
              <div className="stack">
                {tasks.map((task) => (
                  <article className="task" key={task.id}>
                    <div className="task-header">
                      <div className="task-title">{task.title}</div>
                      <span className={`badge ${task.status}`}>{task.status}</span>
                    </div>

                    {task.description ? <p className="muted">{task.description}</p> : null}

                    <div className="task-meta">
                      <span className="badge">confidence: {task.confidence}</span>
                      <span className="badge">{task.assigneeEmail ?? "fara responsabil"}</span>
                      <span className="badge">{formatDate(task.dueDate)}</span>
                      {task.projectHint ? <span className="badge">{task.projectHint}</span> : null}
                    </div>

                    <p className="muted">
                      <strong>Evidence:</strong> {task.evidence}
                    </p>

                    {task.plannerTaskId ? (
                      <p className="muted">
                        Planner ID: <code>{task.plannerTaskId}</code>
                      </p>
                    ) : null}

                    {task.status === "proposed" || task.status === "planner_sync_failed" ? (
                      <div>
                        <form action={`/api/tasks/${task.id}/update`} method="post" className="edit-form">
                          <label htmlFor={`actor-${task.id}`}>Actor</label>
                          <input
                            id={`actor-${task.id}`}
                            name="actorEmail"
                            type="email"
                            defaultValue={defaultActorEmail}
                            required
                          />

                          <label htmlFor={`title-${task.id}`}>Titlu</label>
                          <input id={`title-${task.id}`} name="title" defaultValue={task.title} required />

                          <label htmlFor={`description-${task.id}`}>Descriere</label>
                          <textarea
                            id={`description-${task.id}`}
                            name="description"
                            defaultValue={task.description ?? ""}
                          />

                          <div className="compact-grid">
                            <div>
                              <label htmlFor={`assignee-${task.id}`}>Responsabil</label>
                              <input
                                id={`assignee-${task.id}`}
                                name="assigneeEmail"
                                type="email"
                                defaultValue={task.assigneeEmail ?? ""}
                                placeholder="nume@firma.ro"
                              />
                            </div>
                            <div>
                              <label htmlFor={`due-${task.id}`}>Termen</label>
                              <input id={`due-${task.id}`} name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
                            </div>
                          </div>

                          <label htmlFor={`project-${task.id}`}>Proiect</label>
                          <input id={`project-${task.id}`} name="projectHint" defaultValue={task.projectHint ?? ""} />

                          <div className="task-actions">
                            <button className="button-secondary" type="submit">
                              Salveaza editarea
                            </button>
                          </div>
                        </form>

                        <div className="task-actions">
                        <form action={`/api/tasks/${task.id}/approve`} method="post">
                          <input type="hidden" name="actorEmail" value={defaultActorEmail} />
                          <button type="submit">Aproba</button>
                        </form>
                        {task.status === "proposed" ? (
                          <form action={`/api/tasks/${task.id}/reject`} method="post">
                            <input type="hidden" name="actorEmail" value={defaultActorEmail} />
                            <button className="button-danger" type="submit">
                              Respinge
                            </button>
                          </form>
                        ) : null}
                      </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Erori procesare</h2>
            {errors.length === 0 ? (
              <p className="muted">Nu exista erori.</p>
            ) : (
              <div className="stack">
                {errors.slice(0, 5).map((error) => (
                  <div className="event" key={error.id}>
                    <strong className="error-text">{error.stage}</strong>
                    <br />
                    {error.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Audit recent</h2>
            {auditEvents.length === 0 ? (
              <p className="muted">Nu exista evenimente inca.</p>
            ) : (
              <div className="stack">
                {auditEvents.slice(0, 8).map((event) => (
                  <div className="event" key={event.id}>
                    <strong>{event.type}</strong>
                    <br />
                    <span className="muted">{event.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
