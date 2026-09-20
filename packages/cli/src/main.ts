import { createInterface } from "node:readline/promises";

import { flagNumber, flagString, parseArgs } from "./args.js";
import { mutate, query, RosterError } from "./client.js";
import {
  type Config,
  DEFAULT_API_URL,
  loadConfig,
  saveConfig,
} from "./config.js";

const USAGE = `roster — talk to Roster from inside an agent session

  roster login [--api-url URL]              store this machine's API key
  roster channels                           agents you can ask, with handles
  roster read messages --channel-id ID [--limit N]
  roster tasks create <title> [--channel-id ID]
  roster tasks status <task-id> <todo|in_progress|done>
  roster ask <handle> <task> --thread THREAD_ID

Pass --channel-id only when someone named the channel the work belongs to;
that channel's agent starts on it right away. Without it the task waits in
the backlog for a person to assign.

Your thread id, channel id and task id are in the <roster> block at the top
of your session. \`roster ask\` returns immediately — say what you asked for
and end your turn; you are resumed automatically with the answer.`;

function requireConfig(): Config {
  const config = loadConfig();
  if (!config) {
    throw new RosterError(
      "This machine is not logged in to Roster. Run `roster login`.",
    );
  }
  return config;
}

async function login(parsed: ReturnType<typeof parseArgs>): Promise<void> {
  const apiUrl =
    flagString(parsed, "api-url") ?? process.env.ROSTER_API_URL ?? DEFAULT_API_URL;

  const fromFlag = flagString(parsed, "key");
  let key = fromFlag;

  if (!key) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    key = (
      await rl.question("Paste a Roster API key (Settings → API keys): ")
    ).trim();
    rl.close();
  }

  if (!key) throw new RosterError("No key given.");

  const config: Config = { apiUrl, token: key };
  const who = (await query(config, "cli.whoami")) as { agentName?: string };

  const path = saveConfig(config);
  console.log(
    `Logged in as ${who.agentName ?? "this team's member"}. Key stored at ${path}.`,
  );
}

async function channels(): Promise<void> {
  const config = requireConfig();
  const rows = (await query(config, "cli.channels")) as Array<{
    handle: string;
    slug: string;
    visibility: string;
    id: string;
  }>;

  if (rows.length === 0) {
    console.log("No channels you can reach.");
    return;
  }

  for (const row of rows) {
    const lock = row.visibility === "private" ? " (private)" : "";
    console.log(`@${row.handle}  #${row.slug}${lock}  ${row.id}`);
  }
}

async function readMessages(parsed: ReturnType<typeof parseArgs>): Promise<void> {
  const config = requireConfig();
  const channelId = flagString(parsed, "channel-id");
  if (!channelId) throw new RosterError("Pass --channel-id.");

  const result = (await query(config, "cli.readMessages", {
    channelId,
    limit: flagNumber(parsed, "limit") ?? 20,
  })) as {
    channel: { slug: string };
    messages: Array<{ author: string; text: string; createdAt: string }>;
  };

  console.log(`# ${result.channel.slug}`);
  for (const message of result.messages) {
    console.log(`\n[${message.createdAt}] ${message.author}:\n${message.text}`);
  }
}

async function createTask(parsed: ReturnType<typeof parseArgs>): Promise<void> {
  const config = requireConfig();

  const title = parsed.positionals.slice(2).join(" ").trim();
  if (!title) throw new RosterError("Give the task a title.");

  const channelId = flagString(parsed, "channel-id");

  const task = (await mutate(config, "cli.createTask", {
    title,
    ...(channelId ? { channelId } : {}),
  })) as { id: string; title: string; channelSlug: string | null };

  console.log(
    task.channelSlug
      ? `Created task "${task.title}" (${task.id}) and started #${task.channelSlug} on it.`
      : `Created task "${task.title}" (${task.id}). It is in the backlog until someone assigns it.`,
  );
}

const STATUSES = ["todo", "in_progress", "done"];

async function setTaskStatus(
  parsed: ReturnType<typeof parseArgs>,
): Promise<void> {
  const config = requireConfig();

  const taskId = parsed.positionals[2];
  const status = parsed.positionals[3];

  if (!taskId) {
    throw new RosterError(
      "Say which task, e.g. `roster tasks status <task-id> in_progress`. Your task id is in the <roster> block.",
    );
  }
  if (!status || !STATUSES.includes(status)) {
    throw new RosterError(`Status must be one of: ${STATUSES.join(", ")}.`);
  }

  const task = (await mutate(config, "cli.setTaskStatus", {
    taskId,
    status,
  })) as { title: string; status: string };

  console.log(`"${task.title}" is now ${task.status}.`);
}

async function ask(parsed: ReturnType<typeof parseArgs>): Promise<void> {
  const config = requireConfig();

  const handle = parsed.positionals[1];
  if (!handle) throw new RosterError("Say which agent to ask, e.g. fern-core.");

  const task = parsed.positionals.slice(2).join(" ").trim();
  if (!task) throw new RosterError("Say what you want done.");

  const threadId = flagString(parsed, "thread") ?? process.env.ROSTER_THREAD_ID;
  if (!threadId) {
    throw new RosterError(
      "Pass --thread with the thread id from your <roster> block.",
    );
  }

  const result = (await mutate(config, "cli.ask", {
    threadId,
    handle,
    task,
  })) as { targetHandle: string };

  console.log(
    `Asked @${result.targetHandle}. Say so and end your turn — you will be resumed with the answer.`,
  );
}

export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const [command, sub] = parsed.positionals;

  try {
    if (!command || command === "help" || parsed.flags.help) {
      console.log(USAGE);
      return 0;
    }

    if (command === "login") await login(parsed);
    else if (command === "channels") await channels();
    else if (command === "read" && sub === "messages") await readMessages(parsed);
    else if (command === "tasks" && sub === "create") await createTask(parsed);
    else if (command === "tasks" && sub === "status") await setTaskStatus(parsed);
    else if (command === "ask") await ask(parsed);
    else {
      console.error(`Unknown command: ${[command, sub].filter(Boolean).join(" ")}\n`);
      console.error(USAGE);
      return 2;
    }

    return 0;
  } catch (cause) {
    console.error(
      cause instanceof RosterError
        ? cause.message
        : `Unexpected failure: ${(cause as Error).message}`,
    );
    return 1;
  }
}
