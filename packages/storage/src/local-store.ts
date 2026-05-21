import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, ProcessingError, ProposedTask, SourceItem } from "@repo/domain/types";

type StoreData = {
  sources: SourceItem[];
  proposedTasks: ProposedTask[];
  auditEvents: AuditEvent[];
  processingErrors: ProcessingError[];
};

const emptyStore: StoreData = {
  sources: [],
  proposedTasks: [],
  auditEvents: [],
  processingErrors: []
};

function dataDir(): string {
  return path.resolve(process.env.LOCAL_DATA_DIR ?? "./data");
}

function storePath(): string {
  return path.join(dataDir(), "store.json");
}

async function readStore(): Promise<StoreData> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return { ...emptyStore, ...JSON.parse(raw) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyStore;
    }
    throw error;
  }
}

async function writeStore(data: StoreData): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(storePath(), JSON.stringify(data, null, 2), "utf8");
}

export const store = {
  async listSources(): Promise<SourceItem[]> {
    return [...(await readStore()).sources].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },

  async findSourceByHash(sourceHash: string): Promise<SourceItem | null> {
    return (await readStore()).sources.find((source) => source.sourceHash === sourceHash) ?? null;
  },

  async saveSource(source: SourceItem): Promise<SourceItem> {
    const data = await readStore();
    const index = data.sources.findIndex((item) => item.id === source.id);
    if (index >= 0) {
      data.sources[index] = source;
    } else {
      data.sources.push(source);
    }
    await writeStore(data);
    return source;
  },

  async listProposedTasks(): Promise<ProposedTask[]> {
    return [...(await readStore()).proposedTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getProposedTask(id: string): Promise<ProposedTask | null> {
    return (await readStore()).proposedTasks.find((task) => task.id === id) ?? null;
  },

  async saveProposedTasks(tasks: ProposedTask[]): Promise<void> {
    const data = await readStore();
    for (const task of tasks) {
      const index = data.proposedTasks.findIndex((item) => item.id === task.id);
      if (index >= 0) {
        data.proposedTasks[index] = task;
      } else {
        data.proposedTasks.push(task);
      }
    }
    await writeStore(data);
  },

  async saveProposedTask(task: ProposedTask): Promise<ProposedTask> {
    await this.saveProposedTasks([task]);
    return task;
  },

  async addAuditEvent(event: AuditEvent): Promise<void> {
    const data = await readStore();
    data.auditEvents.push(event);
    await writeStore(data);
  },

  async listAuditEvents(): Promise<AuditEvent[]> {
    return [...(await readStore()).auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addProcessingError(error: ProcessingError): Promise<void> {
    const data = await readStore();
    data.processingErrors.push(error);
    await writeStore(data);
  },

  async listProcessingErrors(): Promise<ProcessingError[]> {
    return [...(await readStore()).processingErrors].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
};
