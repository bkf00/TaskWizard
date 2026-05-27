"use client";

import type { ProposedTask } from "@repo/domain/types";
import { useMemo, useState } from "react";

type SortMode = "dueDate" | "priority" | "assignee";

const actionableStatuses = new Set<ProposedTask["status"]>(["proposed", "approved", "created_in_planner", "planner_sync_failed"]);
const internalEmployees = ["Tudor", "Florin", "Bogdan", "Sebastian", "Valentin", "Sonia"];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanAssigneeLabel(value: string): string {
  const cleaned = value
    .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/^[\s=:#,-]*\d+\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "fara responsabil";
}

function assigneeLabel(task: ProposedTask): string {
  return cleanAssigneeLabel(task.assigneeName ?? task.assigneeEmail ?? "fara responsabil");
}

function employeeForTask(task: ProposedTask): string | null {
  const raw = normalizeText(`${task.assigneeName ?? ""} ${task.assigneeEmail ?? ""}`);
  return internalEmployees.find((employee) => new RegExp(`\\b${normalizeText(employee)}\\b`, "i").test(raw)) ?? null;
}

function taskMatchesAssigneeFilter(task: ProposedTask, filter: string): boolean {
  if (filter === "all") return true;
  if (filter.startsWith("employee:")) return employeeForTask(task) === filter.slice("employee:".length);
  if (filter.startsWith("other:")) return !employeeForTask(task) && assigneeLabel(task) === filter.slice("other:".length);
  return true;
}

function sortFilterTags<T extends { name: string; count: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ro"));
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
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("dueDate");

  const scopedTasks = useMemo(() => {
    return tasks.filter((task) => actionableStatuses.has(task.status));
  }, [tasks]);

  const employeeFilters = useMemo(() => {
    return sortFilterTags(internalEmployees.map((name) => ({
      name,
      count: scopedTasks.filter((task) => employeeForTask(task) === name).length
    })));
  }, [scopedTasks]);

  const otherAssignees = useMemo(() => {
    return sortFilterTags([...new Set(scopedTasks.filter((task) => !employeeForTask(task)).map(assigneeLabel))]
      .map((name) => ({
        name,
        count: scopedTasks.filter((task) => !employeeForTask(task) && assigneeLabel(task) === name).length
      })));
  }, [scopedTasks]);

  const visibleTasks = useMemo(() => {
    return scopedTasks
      .filter((task) => taskMatchesAssigneeFilter(task, assigneeFilter))
      .sort((a, b) => {
        if (sortMode === "priority") return priorityRank(a) - priorityRank(b) || dueSortValue(a) - dueSortValue(b);
        if (sortMode === "assignee") return assigneeLabel(a).localeCompare(assigneeLabel(b), "ro") || dueSortValue(a) - dueSortValue(b);
        return dueSortValue(a) - dueSortValue(b) || priorityRank(a) - priorityRank(b);
      });
  }, [assigneeFilter, scopedTasks, sortMode]);

  const groupedByAssignee = useMemo(() => {
    const assignees = [...new Set(visibleTasks.map(assigneeLabel))].sort((a, b) => a.localeCompare(b, "ro"));
    return assignees.map((name) => ({
      name,
      tasks: visibleTasks.filter((task) => assigneeLabel(task) === name)
    })).filter((group) => group.tasks.length > 0);
  }, [visibleTasks]);

  const calendar = useMemo(() => calendarDays(visibleTasks), [visibleTasks]);
  const highPriorityCount = visibleTasks.filter((task) => task.priority === "high").length;
  const overdueCount = visibleTasks.filter((task) => task.dueDate && dueSortValue(task) < Date.now()).length;

  return (
    <div className="task-board-shell">
      <section className="panel task-board-main">
        <div className="task-board-toolbar">
          <div>
            <h2>View taskuri</h2>
            <p className="muted">Taskuri active, aprobate sau in asteptare de aprobare.</p>
          </div>
          <div className="board-controls">
            <select aria-label="Sortare taskuri" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="dueDate">Termen</option>
              <option value="priority">Prioritate</option>
              <option value="assignee">Responsabil</option>
            </select>
          </div>
        </div>

        <div className="assignee-filter" aria-label="Filtre responsabili">
          <div className="assignee-filter-row employee-row">
            <span className="filter-row-label">Angajati</span>
            <button className={assigneeFilter === "all" ? "filter-button active" : "filter-button"} type="button" onClick={() => setAssigneeFilter("all")}>
              <span>Toti</span>
              <span className="count">{scopedTasks.length}</span>
            </button>
            {employeeFilters.map((item) => (
              <button
                className={assigneeFilter === `employee:${item.name}` ? "filter-button active" : "filter-button"}
                disabled={item.count === 0}
                key={item.name}
                type="button"
                onClick={() => setAssigneeFilter(`employee:${item.name}`)}
              >
                <span>{item.name}</span>
                <span className="count">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="assignee-filter-row other-row">
            <span className="filter-row-label">Altii</span>
            {otherAssignees.length === 0 ? (
              <span className="muted empty-filter-note">Nu exista alti responsabili in filtrul curent.</span>
            ) : (
              otherAssignees.map((item) => (
                <button
                  className={assigneeFilter === `other:${item.name}` ? "filter-button active" : "filter-button"}
                  key={item.name}
                  type="button"
                  onClick={() => setAssigneeFilter(`other:${item.name}`)}
                >
                  <span>{item.name}</span>
                  <span className="count">{item.count}</span>
                </button>
              ))
            )}
          </div>
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
