// Keep Worker binding types scoped; browser Response.json retains DOM typing.
declare module "cloudflare:workers" {
  export const env: {
    DB: import("@cloudflare/workers-types/index.ts").D1Database;
  };
}
