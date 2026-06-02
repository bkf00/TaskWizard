"use client";

import type { ProposedTask } from "@repo/domain/types";
import { effectiveTaskPriority, isTaskOverdue } from "@repo/domain/task-urgency";
import { useMemo, useState } from "react";

type SortMode = "dueDate" | "priority" | "assignee";

const actionableStatuses = new Set<ProposedTask["status"]>(["proposed", "approved", "created_in_planner", "planner_sync_failed"]);
const internalEmployees = ["Tudor", "Florin", "Bogdan", "Sebastian", "Valentin", "Sonia"];
const employeeMatchers = internalEmployees.map((employee) => ({
  name: employee,
  pattern: new RegExp(`\\b${normalizeText(employee)}\\b`, "i")
}));

type TaskBoardRow = {
  task: ProposedTask;
  assignee: string;
  employee: string | null;
};

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
  return employeeMatchers.find((employee) => employee.pattern.test(raw))?.name ?? null;
}

function taskBoardRow(task: ProposedTask): TaskBoardRow {
  return {
    task,
    assignee: assigneeLabel(task),
    employee: employeeForTask(task)
  };
}

function taskMatchesAssigneeFilter(row: TaskBoardRow, filter: string): boolean {
  if (filter === "all") return true;
  if (filter.startsWith("employee:")) return row.employee === filter.slice("employee:".length);
  if (filter.startsWith("other:")) return !row.employee && row.assignee === filter.slice("other:".length);
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
  if (effectiveTaskPriority(task) === "urgent") return -1;
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

  const scopedRows = useMemo(() => {
    return tasks.filter((task) => actionableStatuses.has(task.status)).map(taskBoardRow);
  }, [tasks]);

  const employeeFilters = useMemo(() => {
    const counts = new Map(internalEmployees.map((name) => [name, 0]));
    for (const row of scopedRows) {
      if (row.employee) counts.set(row.employee, (counts.get(row.employee) ?? 0) + 1);
    }

    return sortFilterTags(internalEmployees.map((name) => ({ name, count: counts.get(name) ?? 0 })));
  }, [scopedRows]);

  const otherAssignees = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of scopedRows) {
      if (!row.employee) counts.set(row.assignee, (counts.get(row.assignee) ?? 0) + 1);
    }

    return sortFilterTags([...counts].map(([name, count]) => ({ name, count })));
  }, [scopedRows]);

  const visibleRows = useMemo(() => {
    return scopedRows
      .filter((row) => taskMatchesAssigneeFilter(row, assigneeFilter))
      .sort((a, b) => {
        if (sortMode === "priority") return priorityRank(a.task) - priorityRank(b.task) || dueSortValue(a.task) - dueSortValue(b.task);
        if (sortMode === "assignee") return a.assignee.localeCompare(b.assignee, "ro") || dueSortValue(a.task) - dueSortValue(b.task);
        return dueSortValue(a.task) - dueSortValue(b.task) || priorityRank(a.task) - priorityRank(b.task);
      });
  }, [assigneeFilter, scopedRows, sortMode]);

  const visibleTasks = useMemo(() => visibleRows.map((row) => row.task), [visibleRows]);

  const groupedByAssignee = useMemo(() => {
    const groups = new Map<string, TaskBoardRow[]>();
    for (const row of visibleRows) {
      const group = groups.get(row.assignee);
      if (group) {
        group.push(row);
      } else {
        groups.set(row.assignee, [row]);
      }
    }

    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b, "ro"))
      .map(([name, rows]) => ({ name, rows }));
  }, [visibleRows]);

  const calendar = useMemo(() => calendarDays(visibleTasks), [visibleTasks]);
  const taskCounts = useMemo(() => {
    let highPriority = 0;
    let overdue = 0;
    for (const task of visibleTasks) {
      if (task.priority === "high") highPriority += 1;
      if (isTaskOverdue(task)) overdue += 1;
    }
    return { highPriority, overdue };
  }, [visibleTasks]);

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
              <span className="count">{scopedRows.length}</span>
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
                {group.rows.map((row) => <TaskBoardCard actorEmail={actorEmail} assignee={row.assignee} key={row.task.id} task={row.task} />)}
              </section>
            ))
          ) : (
            visibleRows.map((row) => <TaskBoardCard actorEmail={actorEmail} assignee={row.assignee} key={row.task.id} task={row.task} />)
          )}
        </div>
      </section>

      <aside className="task-board-side">
        <section className="panel">
          <h2>Rezumat</h2>
          <div className="side-metrics">
            <div><strong>{visibleTasks.length}</strong><span>vizibile</span></div>
            <div><strong>{taskCounts.highPriority}</strong><span>prioritare</span></div>
            <div><strong>{taskCounts.overdue}</strong><span>intarziate</span></div>
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
                      <div className={isTaskOverdue(task) ? "calendar-item urgent" : task.priority === "high" ? "calendar-item priority" : "calendar-item"} key={task.id}>
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

function TaskBoardCard({ task, actorEmail, assignee }: { task: ProposedTask; actorEmail: string; assignee: string }) {
  const canClose = task.status === "approved" || task.status === "created_in_planner" || task.status === "planner_sync_failed";
  const taskIsOverdue = isTaskOverdue(task);
  const nextDueDate = tomorrowIsoDate();

  return (
    <article className={taskIsOverdue ? "task-card board-card overdue-card" : "task-card board-card"} data-status={task.status}>
      <div className="task-top">
        <div className="task-title">{task.title}</div>
        <span className={`badge ${task.status}`}>{task.status}</span>
      </div>
      <div className="meta">
        <span className="badge">{assignee}</span>
        <span className="badge">{formatDate(task.dueDate)}</span>
        {taskIsOverdue ? <span className="badge urgent-priority">urgent</span> : null}
        <span className={task.priority === "high" ? "badge high-priority" : "badge"}>{task.priority === "high" ? "prioritar" : "normal"}</span>
        <span className="badge">confidence: {task.confidence}</span>
      </div>
      {task.description ? <div className="evidence">{task.description}</div> : null}
      {taskIsOverdue ? (
        <div className="overdue-actions">
          <form action={`/api/tasks/${task.id}/follow-up`} method="post">
            <input type="hidden" name="actorEmail" value={actorEmail} />
            <input type="hidden" name="redirectTo" value="/tasks" />
            <input type="hidden" name="dueDate" value={nextDueDate} />
            <button className="button-priority" type="submit">Creeaza follow-up</button>
          </form>
          <form action={`/api/tasks/${task.id}/extend`} className="inline-date-form" method="post">
            <input type="hidden" name="actorEmail" value={actorEmail} />
            <input type="hidden" name="redirectTo" value="/tasks" />
            <input aria-label="Noul termen" name="dueDate" type="date" defaultValue={nextDueDate} required />
            <button className="button-muted" type="submit">Prelungeste</button>
          </form>
        </div>
      ) : null}
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

function tomorrowIsoDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
