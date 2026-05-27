"use client";

import type { ProposedTask } from "@repo/domain/types";
import { useMemo, useState } from "react";

type SortMode = "dueDate" | "priority" | "assignee";
type ScopeMode = "active" | "all";

const activeStatuses = new Set<ProposedTask["status"]>(["approved", "created_in_planner", "planner_sync_failed", "proposed"]);

function assigneeLabel(task: ProposedTask): string {
  return task.assigneeName ?? task.assigneeEmail ?? "fara responsabil";
}

function formatDate(value: string | null): string {
  if (!value) return "fara termen";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(value));
}

function dueSortValue(task: ProposedTask): number {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  return new Date(`${task.dueDate}T00:00:00.000Z`).getTime();
}

function priorityRank(task: ProposedTask): number {
  if (task.priority === "high") return 0;
  if (task.confidence === "high") return 1;
  if (task.confidence === "medium") return 2;
  return 3;
}

function calendarDays(tasks: ProposedTask[]) {
  const datedTasks = tasks.filter((task) => task.dueDate);
  const dates = [...new Set(datedTasks.map((task) => task.dueDate as string))].sort().slice(0, 10);
  return dates.map((date) => ({
    date,
    tasks: datedTasks.filter((task) => task.dueDate === date)
  }));
}

export function TaskBoard({ tasks, actorEmail }: { tasks: ProposedTask[]; actorEmail: string }) {
  const [assignee, setAssignee] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("dueDate");
  const [scope, setScope] = useState<ScopeMode>("active");

  const assignees = useMemo(() => {
    return [...new Set(tasks.map(assigneeLabel))].sort((a, b) => a.localeCompare(b, "ro"));
  }, [tasks]);

  const scopedTasks = useMemo(() => {
    return tasks.filter((task) => (scope === "all" ? true : activeStatuses.has(task.status)));
  }, [scope, tasks]);

  const visibleTasks = useMemo(() => {
    return scopedTasks
      .filter((task) => (assignee === "all" ? true : assigneeLabel(task) === assignee))
      .sort((a, b) => {
        if (sortMode === "priority") return priorityRank(a) - priorityRank(b) || dueSortValue(a) - dueSortValue(b);
        if (sortMode === "assignee") return assigneeLabel(a).localeCompare(assigneeLabel(b), "ro") || dueSortValue(a) - dueSortValue(b);
        return dueSortValue(a) - dueSortValue(b) || priorityRank(a) - priorityRank(b);
      });
  }, [assignee, scopedTasks, sortMode]);

  const groupedByAssignee = useMemo(() => {
    return assignees.map((name) => ({
      name,
      tasks: visibleTasks.filter((task) => assigneeLabel(task) === name)
    })).filter((group) => group.tasks.length > 0);
  }, [assignees, visibleTasks]);

  const calendar = useMemo(() => calendarDays(visibleTasks), [visibleTasks]);
  const highPriorityCount = visibleTasks.filter((task) => task.priority === "high").length;
  const overdueCount = visibleTasks.filter((task) => task.dueDate && dueSortValue(task) < Date.now()).length;

  return (
    <div className="task-board-shell">
      <section className="panel task-board-main">
        <div className="task-board-toolbar">
          <div>
            <h2>View taskuri</h2>
            <p className="muted">Sorteaza dupa termen, prioritate sau responsabil.</p>
          </div>
          <div className="board-controls">
            <select aria-label="Scope taskuri" value={scope} onChange={(event) => setScope(event.target.value as ScopeMode)}>
              <option value="active">Active + de verificat</option>
              <option value="all">Toate taskurile</option>
            </select>
            <select aria-label="Sortare taskuri" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="dueDate">Termen</option>
              <option value="priority">Prioritate</option>
              <option value="assignee">Responsabil</option>
            </select>
          </div>
        </div>

        <div className="assignee-filter" aria-label="Filtre responsabili">
          <button className={assignee === "all" ? "filter-button active" : "filter-button"} type="button" onClick={() => setAssignee("all")}>
            <span>Toti</span>
            <span className="count">{scopedTasks.length}</span>
          </button>
          {assignees.map((name) => (
            <button
              className={assignee === name ? "filter-button active" : "filter-button"}
              key={name}
              type="button"
              onClick={() => setAssignee(name)}
            >
              <span>{name}</span>
              <span className="count">{scopedTasks.filter((task) => assigneeLabel(task) === name).length}</span>
            </button>
          ))}
        </div>

        <div className="task-board-list">
          {visibleTasks.length === 0 ? (
            <div className="empty">Nu exista taskuri in filtrul curent.</div>
          ) : sortMode === "assignee" ? (
            groupedByAssignee.map((group) => (
              <section className="assignee-group" key={group.name}>
                <h3>{group.name}</h3>
                {group.tasks.map((task) => <TaskBoardCard actorEmail={actorEmail} key={task.id} task={task} />)}
              </section>
            ))
          ) : (
            visibleTasks.map((task) => <TaskBoardCard actorEmail={actorEmail} key={task.id} task={task} />)
          )}
        </div>
      </section>

      <aside className="task-board-side">
        <section className="panel">
          <h2>Rezumat</h2>
          <div className="side-metrics">
            <div><strong>{visibleTasks.length}</strong><span>vizibile</span></div>
            <div><strong>{highPriorityCount}</strong><span>prioritare</span></div>
            <div><strong>{overdueCount}</strong><span>intarziate</span></div>
          </div>
        </section>

        <section className="panel calendar-panel">
          <h2>Calendar</h2>
          {calendar.length === 0 ? (
            <div className="empty">Nu exista termene in filtrul curent.</div>
          ) : (
            <div className="calendar-list">
              {calendar.map((day) => (
                <div className="calendar-day" key={day.date}>
                  <div className="calendar-date">{formatDate(day.date)}</div>
                  <div className="calendar-items">
                    {day.tasks.map((task) => (
                      <div className={task.priority === "high" ? "calendar-item priority" : "calendar-item"} key={task.id}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function TaskBoardCard({ task, actorEmail }: { task: ProposedTask; actorEmail: string }) {
  const canClose = task.status === "approved" || task.status === "created_in_planner" || task.status === "planner_sync_failed";

  return (
    <article className="task-card board-card" data-status={task.status}>
      <div className="task-top">
        <div className="task-title">{task.title}</div>
        <span className={`badge ${task.status}`}>{task.status}</span>
      </div>
      <div className="meta">
        <span className="badge">{assigneeLabel(task)}</span>
        <span className="badge">{formatDate(task.dueDate)}</span>
        <span className={task.priority === "high" ? "badge high-priority" : "badge"}>{task.priority === "high" ? "prioritar" : "normal"}</span>
        <span className="badge">confidence: {task.confidence}</span>
      </div>
      {task.description ? <div className="evidence">{task.description}</div> : null}
      {canClose ? (
        <div className="actions">
          <form action={`/api/tasks/${task.id}/complete`} method="post">
            <input type="hidden" name="actorEmail" value={actorEmail} />
            <button className="button-muted" type="submit">Terminat</button>
          </form>
          <form action={`/api/tasks/${task.id}/delete`} method="post">
            <input type="hidden" name="actorEmail" value={actorEmail} />
            <button className="danger" type="submit">Sters</button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
