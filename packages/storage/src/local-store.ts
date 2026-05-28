import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, ProcessingError, ProposedTask, SourceItem } from "@repo/domain/types";
import { taskIdentityKey } from "@repo/domain/task-identity";
import { emptyStoreSnapshot, type StoreSnapshot, type TaskWizardRepository } from "./repository";

function dataDir(): string {
  return path.resolve(process.env.LOCAL_DATA_DIR ?? "./data");
}

function storePath(): string {
  return path.join(dataDir(), "store.json");
}

export class JsonFileTaskWizardRepository implements TaskWizardRepository {
  constructor(private readonly filePath = storePath()) {}

  private async readStore(): Promise<StoreSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = { ...emptyStoreSnapshot, ...JSON.parse(raw) } as StoreSnapshot;
      return {
        ...parsed,
        proposedTasks: parsed.proposedTasks.map((task) => ({
          ...task,
          priority: task.priority ?? "normal",
          visibility: task.visibility ?? "team",
          visibleToEmails: task.visibleToEmails ?? []
        }))
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(emptyStoreSnapshot);
      }
      throw error;
    }
  }

  private async writeStore(data: StoreSnapshot): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async listSources(): Promise<SourceItem[]> {
    return [...(await this.readStore()).sources].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async findSourceByHash(sourceHash: string): Promise<SourceItem | null> {
    return (await this.readStore()).sources.find((source) => source.sourceHash === sourceHash) ?? null;
  }

  async saveSource(source: SourceItem): Promise<SourceItem> {
    const data = await this.readStore();
    const index = data.sources.findIndex((item) => item.id === source.id);
    if (index >= 0) {
      data.sources[index] = source;
    } else {
      data.sources.push(source);
    }
    await this.writeStore(data);
    return source;
  }

  async listProposedTasks(): Promise<ProposedTask[]> {
    return [...(await this.readStore()).proposedTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProposedTask(id: string): Promise<ProposedTask | null> {
    return (await this.readStore()).proposedTasks.find((task) => task.id === id) ?? null;
  }

  async saveProposedTasks(tasks: ProposedTask[]): Promise<void> {
    const data = await this.readStore();
    const taskIndexById = new Map(data.proposedTasks.map((task, index) => [task.id, index]));
    const seenIdentities = new Set(data.proposedTasks.map(taskIdentityKey).filter((key): key is string => Boolean(key)));

    for (const task of tasks) {
      const index = taskIndexById.get(task.id) ?? -1;
      if (index >= 0) {
        const previousIdentity = taskIdentityKey(data.proposedTasks[index]);
        if (previousIdentity) seenIdentities.delete(previousIdentity);
        data.proposedTasks[index] = task;
        const nextIdentity = taskIdentityKey(task);
        if (nextIdentity) seenIdentities.add(nextIdentity);
      } else {
        const identity = taskIdentityKey(task);
        if (!identity) {
          data.proposedTasks.push(task);
          taskIndexById.set(task.id, data.proposedTasks.length - 1);
          continue;
        }
        if (seenIdentities.has(identity)) continue;
        seenIdentities.add(identity);
        data.proposedTasks.push(task);
        taskIndexById.set(task.id, data.proposedTasks.length - 1);
      }
    }
    await this.writeStore(data);
  }

  async saveProposedTask(task: ProposedTask): Promise<ProposedTask> {
    await this.saveProposedTasks([task]);
    return task;
  }

  async addAuditEvent(event: AuditEvent): Promise<void> {
    const data = await this.readStore();
    data.auditEvents.push(event);
    await this.writeStore(data);
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    return [...(await this.readStore()).auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addProcessingError(error: ProcessingError): Promise<void> {
    const data = await this.readStore();
    data.processingErrors.push(error);
    await this.writeStore(data);
  }

  async listProcessingErrors(): Promise<ProcessingError[]> {
    return [...(await this.readStore()).processingErrors].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function createLocalJsonRepository(filePath = storePath()): TaskWizardRepository {
  return new JsonFileTaskWizardRepository(filePath);
}

export const store: TaskWizardRepository = createLocalJsonRepository();
