export interface Profile {
  name: string;
  domain: string;
  auth: SessionAuth | ApiKeyAuth;
  user?: CachedUser;
  defaultDb?: number;
}

export interface SessionAuth {
  method: "session";
  email: string;
  password: string;
  sessionToken?: string;
}

export interface ApiKeyAuth {
  method: "api-key";
  apiKey: string;
}

export interface CachedUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
}

export interface Config {
  activeProfile: string;
  profiles: Record<string, Profile>;
}

export interface SessionResponse {
  id: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  common_name: string;
  locale: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string;
  [key: string]: unknown;
}

export interface Database {
  id: number;
  name: string;
  engine: string;
  is_sample: boolean;
  [key: string]: unknown;
}

export interface Table {
  id: number;
  name: string;
  display_name: string;
  db_id: number;
  schema: string;
  [key: string]: unknown;
}

export interface Field {
  id: number;
  name: string;
  display_name: string;
  table_id: number;
  base_type: string;
  semantic_type: string | null;
  [key: string]: unknown;
}

export interface Card {
  id: number;
  name: string;
  description: string | null;
  display: string;
  collection_id: number | null;
  creator_id: number;
  dataset_query: DatasetQuery;
  visualization_settings: Record<string, unknown>;
  archived: boolean;
  [key: string]: unknown;
}

export interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  collection_id: number | null;
  creator_id: number;
  dashcards: DashCard[];
  parameters: Parameter[];
  archived: boolean;
  [key: string]: unknown;
}

export interface DashCard {
  id: number;
  card_id: number | null;
  card: Card | null;
  row: number;
  col: number;
  size_x: number;
  size_y: number;
  parameter_mappings: unknown[];
  visualization_settings: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Parameter {
  id: string;
  name: string;
  type: string;
  slug: string;
  default?: unknown;
  [key: string]: unknown;
}

export interface Collection {
  id: number | "root";
  name: string;
  description: string | null;
  parent_id: number | null;
  archived: boolean;
  [key: string]: unknown;
}

export interface Snippet {
  id: number;
  name: string;
  description: string | null;
  content: string;
  creator_id: number;
  archived: boolean;
  collection_id: number | null;
  [key: string]: unknown;
}

export interface DatasetQuery {
  type: "native" | "query";
  database: number;
  native?: {
    query: string;
    "template-tags"?: Record<string, unknown>;
  };
  query?: Record<string, unknown>;
}

export interface DatasetResponse {
  data: {
    rows: unknown[][];
    cols: DatasetColumn[];
    results_metadata?: { columns: DatasetColumn[] };
    native_form?: { query: string };
    rows_truncated?: number;
  };
  row_count: number;
  status: string;
  [key: string]: unknown;
}

export interface DatasetColumn {
  name: string;
  display_name: string;
  base_type: string;
  semantic_type?: string | null;
  [key: string]: unknown;
}

export interface SearchResult {
  id: number;
  name: string;
  model: string;
  description: string | null;
  collection_id: number | null;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Alert {
  id: number;
  card: { id: number; name?: string; [key: string]: unknown };
  alert_condition: "rows" | "goal";
  alert_first_only: boolean;
  alert_above_goal: boolean | null;
  creator: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    [key: string]: unknown;
  };
  channels: unknown[];
  archived: boolean;
  [key: string]: unknown;
}

export interface Revision {
  id: number;
  model: string;
  model_id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    [key: string]: unknown;
  };
  timestamp: string;
  description: string | null;
  is_reversion: boolean;
  is_creation: boolean;
  [key: string]: unknown;
}

export interface Timeline {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  collection_id: number | null;
  archived: boolean;
  events?: TimelineEvent[];
  [key: string]: unknown;
}

export interface TimelineEvent {
  id: number;
  timeline_id: number;
  name: string;
  description: string | null;
  timestamp: string;
  icon: string;
  time_matters: boolean;
  archived: boolean;
  [key: string]: unknown;
}

export interface Segment {
  id: number;
  name: string;
  description: string | null;
  table_id: number;
  definition: Record<string, unknown>;
  creator_id: number;
  archived: boolean;
  [key: string]: unknown;
}

export interface Notification {
  id: number;
  payload_type: string;
  payload: Record<string, unknown>;
  handlers: unknown[];
  creator_id: number;
  active: boolean;
  [key: string]: unknown;
}

export type OutputFormat = "table" | "json" | "csv" | "tsv";
