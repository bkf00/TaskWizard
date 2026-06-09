import { store } from "@repo/storage/local-store";
import { filterVisibleTasks } from "@repo/domain/privacy";
import { getCurrentActor } from "../../auth-actor";
import { LiveDashboardRefresh } from "../live-dashboard-refresh";
import { getDashboardStateVersion } from "../state-version";
import { TaskBoard } from "./task-board";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const actor = await getCurrentActor();
  const [tasks, stateVersion] = await Promise.all([
    store.listProposedTasks(),
    getDashboardStateVersion(actor.email)
  ]);

  return (
    <main>
      <LiveDashboardRefresh initialVersion={stateVersion.version} />
      <header className="app-header compact-header">
        <div className="brand">
          <Image className="brand-mark" src="/assets/taskwizard-hat.png" alt="TaskWizard" width={64} height={64} priority />
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
          <Link className="button-link" href="/">
            Review inbox
          </Link>
        </div>
      </header>

      <TaskBoard tasks={filterVisibleTasks(tasks, actor.email)} actorEmail={actor.email} />
    </main>
  );
}
