#!/usr/bin/env node
import { main } from "./main.js";

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((cause: unknown) => {
    console.error((cause as Error).message);
    process.exitCode = 1;
  });
