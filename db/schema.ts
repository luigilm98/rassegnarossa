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
