import { db, messages } from "@roster/db";
import { eq } from "drizzle-orm";

import { markdownToTiptap } from "../utils/tiptap";

/**
 * Re-renders the stored body of every agent message from its own text.
 *
 * Agent replies written before markdown parsing landed have a body that is the
 * source split on newlines, so their headings and emphasis read as punctuation.
 * `text` is the original markdown and is never touched, which makes this safe
 * to run again — and to run after any later fix to the parser.
 */
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
