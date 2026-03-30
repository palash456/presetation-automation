export type ProjectStatus = "draft" | "published" | "archived";

export type HistoryVersion = {
  id: string;
  label: string;
  savedAt: string;
  author: string;
  summary?: string;
};

export type PresentationHistory = {
  id: string;
  name: string;
  lastEdited: string;
  status: ProjectStatus;
  versionCount: number;
  versions: HistoryVersion[];
};
