// Core
export { MetabaseClient } from "./client.js";
export { SafetyGuard } from "./safety/guard.js";

// Config
export {
  loadConfig,
  saveConfig,
  getActiveProfile,
  setActiveProfile,
  addProfile,
  removeProfile,
  updateProfile,
  listProfiles,
} from "./config/store.js";

// API modules
export { SessionApi } from "./api/session.js";
export { DatasetApi } from "./api/dataset.js";
export { CardApi } from "./api/card.js";
export { DashboardApi } from "./api/dashboard.js";
export { CollectionApi } from "./api/collection.js";
export { DatabaseApi } from "./api/database.js";
export { TableApi } from "./api/table.js";
export { FieldApi } from "./api/field.js";
export { SnippetApi } from "./api/snippet.js";
export { SearchApi } from "./api/search.js";
export { UserApi } from "./api/user.js";
export { AlertApi } from "./api/alert.js";
export { RevisionApi } from "./api/revision.js";
export { ActivityApi } from "./api/activity.js";
export { TimelineApi } from "./api/timeline.js";
export { SegmentApi } from "./api/segment.js";
export { NotificationApi } from "./api/notification.js";

// Types
export type * from "./types.js";

// Utils
export { formatDatasetResponse, formatJson, formatEntityTable } from "./utils/output.js";
