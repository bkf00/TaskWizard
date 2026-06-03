"use client";

import type { ProposedTask } from "@repo/domain/types";
import { cleanAssigneeName } from "@repo/domain/assignee";
import { useMemo, useState } from "react";

const statusFilters: Array<{ value: ProposedTask["status"]; label: string }> = [
  { value: "proposed", label: "De verificat" },
  { value: "approved", label: "Aprobate" },
  { value: "planner_sync_failed", label: "Sincronizare" },
  { value: "created_in_planner", label: "In Planner" },
  { value: "completed_in_planner", label: "Terminate" },
  { value: "deleted_in_planner", label: "Sterse" },
  { value: "rejected", label: "Respinse" }
];

function formatDate(value: string | null): string {
  if (!value) return "fara termen";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(value));
}

function formatAssignee(task: ProposedTask): string {
  return cleanAssigneeName(task.assigneeName) ?? task.assigneeEmail ?? "fara responsabil";
}

export function TaskHistoryPanel({ tasks, actorEmail }: { tasks: ProposedTask[]; actorEmail: string }) {
  const [filter, setFilter] = useState<ProposedTask["status"] | "all">("all");
  const counts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [tasks]);
  const visibleTasks = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);

  return (
    <section className="panel task-history">
      <h2>Toate taskurile</h2>
      <div className="filters" aria-label="Filtre taskuri">
        <button className={`filter-button ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}>
          <span>Toate</span>
          <span className="count">{tasks.length}</span>
        </button>
        {statusFilters.map((item) => (
          <button
            className={`filter-button ${filter === item.value ? "active" : ""}`}
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
          >
            <span>{item.label}</span>
            <span className="count">{counts[item.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="history-list">
        {visibleTasks.length === 0 ? (
          <div className="empty">Nu exista taskuri in filtrul selectat.</div>
        ) : (
          visibleTasks.map((task) => (
            <article className="history-card" key={task.id}>
              <div className="history-top">
                <div className="history-title">{task.title}</div>
                <span className={`badge ${task.status}`}>{task.status}</span>
              </div>
              <div className="history-meta">
                <span className="badge">{formatAssignee(task)}</span>
                <span className="badge">{formatDate(task.dueDate)}</span>
                {task.priority === "high" ? <span className="badge high-priority">prioritar</span> : null}
              </div>
              {task.status === "approved" || task.status === "created_in_planner" || task.status === "planner_sync_failed" ? (
                <div className="actions">
                  <form action={`/api/tasks/${task.id}/complete`} method="post">
                    <input type="hidden" name="actorEmail" value={actorEmail} />
                    <button className="button-muted" type="submit">
                      Terminat
                    </button>
                  </form>
                  <form action={`/api/tasks/${task.id}/delete`} method="post">
                    <input type="hidden" name="actorEmail" value={actorEmail} />
                    <button className="danger" type="submit">
                      Sters
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
