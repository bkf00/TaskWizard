import { store } from "@repo/storage/local-store";
import { getCurrentActor } from "../../auth-actor";
import { LiveDashboardRefresh } from "../live-dashboard-refresh";
import { getDashboardStateVersion } from "../state-version";
import { TaskBoard } from "./task-board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [actor, tasks, stateVersion] = await Promise.all([
    getCurrentActor(),
    store.listProposedTasks(),
    getDashboardStateVersion()
  ]);

  return (
    <main>
      <LiveDashboardRefresh initialVersion={stateVersion.version} />
      <header className="app-header compact-header">
        <div className="brand">
          <img className="brand-mark" src="/assets/taskwizard-hat.png" alt="TaskWizard" />
          <div>
            <h1>TaskWizard</h1>
            <p className="muted">View operational pentru taskuri, termene si responsabili.</p>
            <p className="muted actor-line">
              Actor: {actor.name ? `${actor.name} / ` : ""}
              {actor.email}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <a className="button-link" href="/">
            Review inbox
          </a>
        </div>
      </header>

      <TaskBoard tasks={tasks} actorEmail={actor.email} />
    </main>
  );
}
