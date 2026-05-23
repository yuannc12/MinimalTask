export type TaskStatus = "backlog" | "today" | "done";

export type EndedReason = "stop" | "complete" | "app_quit";

export interface Task {
  id: number;
  title: string;
  note: string | null;
  tag: string | null;
  estimated_minutes: number | null;
  status: TaskStatus;
  position: number;
  created_at: number;
  completed_at: number | null;
}

export interface Session {
  id: number;
  task_id: number;
  started_at: number;
  ended_at: number | null;
  duration_sec: number | null;
  ended_reason: EndedReason | null;
}

export interface TaskTotals {
  worked_sec: number;
  estimated_min: number;
}

export interface NewTask {
  title: string;
  note?: string | null;
  tag?: string | null;
  estimated_minutes?: number | null;
  status?: TaskStatus;
}
