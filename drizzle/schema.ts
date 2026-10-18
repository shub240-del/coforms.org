import {
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Starter account table used by the existing Manus OAuth scaffolding. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** SpaceForm owns its accounts independently from the starter's Manus OAuth users. */
export const sfAccounts = mysqlTable("spaceform_accounts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  provider: varchar("provider", { length: 32 }).default("password").notNull(),
  providerSubject: varchar("providerSubject", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ providerSubjectUnique: uniqueIndex("spaceform_accounts_provider_subject_unique").on(table.provider, table.providerSubject) }));
export type SfAccount = typeof sfAccounts.$inferSelect;

export const sfSessions = mysqlTable("spaceform_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accountId: varchar("accountId", { length: 36 }).notNull().references(() => sfAccounts.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
}, table => ({ accountIdx: index("spaceform_sessions_account_idx").on(table.accountId) }));

export const sfWorkspaces = mysqlTable("spaceform_workspaces", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerAccountId: varchar("ownerAccountId", { length: 36 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIdx: index("spaceform_workspaces_owner_idx").on(table.ownerAccountId),
  ownerFk: foreignKey({ name: "sf_workspace_owner_fk", columns: [table.ownerAccountId], foreignColumns: [sfAccounts.id] }).onDelete("cascade"),
}));

export const sfWorkspaceMembers = mysqlTable("spaceform_workspace_members", {
  workspaceId: varchar("workspaceId", { length: 36 }).notNull(),
  accountId: varchar("accountId", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["owner", "editor", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  memberPk: primaryKey({ columns: [table.workspaceId, table.accountId] }),
  workspaceFk: foreignKey({ name: "sf_member_workspace_fk", columns: [table.workspaceId], foreignColumns: [sfWorkspaces.id] }).onDelete("cascade"),
  accountFk: foreignKey({ name: "sf_member_account_fk", columns: [table.accountId], foreignColumns: [sfAccounts.id] }).onDelete("cascade"),
}));

export const sfForms = mysqlTable("spaceform_forms", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 36 }).notNull().references(() => sfWorkspaces.id, { onDelete: "cascade" }),
  ownerAccountId: varchar("ownerAccountId", { length: 36 }).notNull().references(() => sfAccounts.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  theme: text("theme"),
  settings: text("settings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  publishedAt: timestamp("publishedAt"),
}, table => ({ workspaceIdx: index("spaceform_forms_workspace_idx").on(table.workspaceId), ownerIdx: index("spaceform_forms_owner_idx").on(table.ownerAccountId) }));

export const sfQuestions = mysqlTable("spaceform_questions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  formId: varchar("formId", { length: 36 }).notNull().references(() => sfForms.id, { onDelete: "cascade" }),
  position: int("position").notNull(),
  type: varchar("type", { length: 48 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  required: int("required").default(0).notNull(),
  archived: int("archived").default(0).notNull(),
  settings: text("settings"),
  logic: text("logic"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ formPositionIdx: index("spaceform_questions_form_position_idx").on(table.formId, table.position) }));

export const sfResponses = mysqlTable("spaceform_responses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  formId: varchar("formId", { length: 36 }).notNull().references(() => sfForms.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["in_progress", "submitted"]).default("submitted").notNull(),
  respondentEmail: varchar("respondentEmail", { length: 320 }),
  metadata: text("metadata"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  submittedAt: timestamp("submittedAt"),
}, table => ({ formSubmittedIdx: index("spaceform_responses_form_submitted_idx").on(table.formId, table.submittedAt) }));

export const sfAnswers = mysqlTable("spaceform_answers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  responseId: varchar("responseId", { length: 36 }).notNull().references(() => sfResponses.id, { onDelete: "cascade" }),
  questionId: varchar("questionId", { length: 36 }).notNull().references(() => sfQuestions.id, { onDelete: "cascade" }),
  value: text("value"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ responseQuestionUnique: uniqueIndex("spaceform_answers_response_question_unique").on(table.responseId, table.questionId), questionIdx: index("spaceform_answers_question_idx").on(table.questionId) }));

export const sfResponseEvents = mysqlTable("spaceform_response_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  responseId: varchar("responseId", { length: 36 }).notNull().references(() => sfResponses.id, { onDelete: "cascade" }),
  questionId: varchar("questionId", { length: 36 }).references(() => sfQuestions.id, { onDelete: "set null" }),
  eventType: varchar("eventType", { length: 48 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ responseIdx: index("spaceform_response_events_response_idx").on(table.responseId) }));

export const sfUploads = mysqlTable("spaceform_uploads", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accountId: varchar("accountId", { length: 36 }).references(() => sfAccounts.id, { onDelete: "set null" }),
  formId: varchar("formId", { length: 36 }).references(() => sfForms.id, { onDelete: "set null" }),
  responseId: varchar("responseId", { length: 36 }).references(() => sfResponses.id, { onDelete: "set null" }),
  key: varchar("key", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  contentType: varchar("contentType", { length: 160 }),
  byteSize: int("byteSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ accountIdx: index("spaceform_uploads_account_idx").on(table.accountId), formIdx: index("spaceform_uploads_form_idx").on(table.formId), responseIdx: index("spaceform_uploads_response_idx").on(table.responseId) }));
