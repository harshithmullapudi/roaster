import { db, messages } from "@roster/db";
import { eq } from "drizzle-orm";

import { markdownToTiptap } from "../utils/tiptap";

async function main(): Promise<void> {
  const rows = await db
    .select({ id: messages.id, text: messages.text })
    .from(messages)
    .where(eq(messages.kind, "agent"));

  for (const row of rows) {
    await db
      .update(messages)
      .set({ body: markdownToTiptap(row.text) })
      .where(eq(messages.id, row.id));
  }

  console.log(`Re-rendered ${rows.length} agent messages.`);
}

main()
  .then(() => process.exit(0))
  .catch((cause) => {
    console.error(cause);
    process.exit(1);
  });
