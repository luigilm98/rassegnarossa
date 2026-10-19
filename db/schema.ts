import { integer, sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";
// Private per-account metadata snapshots. Authentication is supplied by Sites.
export const bookmarks = sqliteTable("bookmarks", {
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  itemKey: text("item_key").notNull(),
  payload: text("payload").notNull(),
  deleted: integer("deleted").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, table => [
  primaryKey({ columns: [table.ownerId, table.kind, table.itemKey] }),
  index("bookmarks_owner_updated_idx").on(table.ownerId, table.updatedAt),
]);
// Bounded public news cache; never contains account or bookmark metadata.
export const publicNewsCache = sqliteTable("public_news_cache", {
  cacheKey: text("cache_key").primaryKey(),
  body: text("body").notNull(),
  headers: text("headers").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
// Last reading location is private, persistent and separate from public content caches.
export const readingProgress = sqliteTable("reading_progress", {
  ownerId: text("owner_id").notNull(),
  bookId: text("book_id").notNull(),
  edition: text("edition").notNull(),
  chapter: integer("chapter").notNull(),
  page: integer("page").notNull(),
  scroll: integer("scroll").notNull().default(0),
  revision: text("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.bookId, table.edition] })]);

// Public proposals keep account identifiers private; votes are unique per proposal and account key.
export const communityProposals = sqliteTable("community_proposals", {
  id: text("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  references: text("references_text").notNull().default(""),
  category: text("category").notNull(),
  language: text("language").notNull(),
  createdAt: integer("created_at").notNull(),
  withdrawn: integer("withdrawn").notNull().default(0),
}, table => [index("community_created_idx").on(table.createdAt), index("community_owner_created_idx").on(table.ownerKey, table.createdAt)]);
export const communityVotes = sqliteTable("community_votes", {
  proposalId: text("proposal_id").notNull(),
  voterKey: text("voter_key").notNull(),
  value: integer("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({columns:[table.proposalId,table.voterKey]})]);
