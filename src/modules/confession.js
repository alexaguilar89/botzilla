const github = require("octonode");
const settings = require("../settings");
const utils = require("../utils");

let GITHUB_CLIENT = null;

async function init(config) {
  GITHUB_CLIENT = github.client(config.githubToken);
}

const PATH = "users/{USER}/{USER}.{ERA}.txt";

const CONFESSION_REGEXP = /^confession:(.*)/g;

const COOLDOWN_TIMEOUT = 1000 * 60 * 60; // every 10 minutes
const COOLDOWN_NUM_MESSAGES = null;
let cooldown = new utils.Cooldown(COOLDOWN_TIMEOUT, COOLDOWN_NUM_MESSAGES);

async function handler(client, msg, extra) {
  if (!GITHUB_CLIENT) {
    return;
  }

  let userRepo = await settings.getOption(msg.room, "confession", "userRepo");
  if (!userRepo) {
    return;
  }

  CONFESSION_REGEXP.lastIndex = 0;
  let match = CONFESSION_REGEXP.exec(msg.body);
  if (match === null) {
    return;
  }

  let confession = match[1].trim();
  if (!confession.length) {
    return;
  }

  let repo = GITHUB_CLIENT.repo(userRepo);

  let now = (Date.now() / 1000) | 0; // for ye ol' asm.js days.

  // Find the million second period (~1.5 weeks) containing this timestamp.
  let era = now - (now % 1000000);

  // Remove prefix '@'.
  let from = msg.sender.substr(1, msg.sender.length);

  let roomAlias = await utils.getRoomAlias(client, msg.room);
  if (!roomAlias) {
    // Probably a personal room.
    roomAlias = "confession";
  }

  let path = PATH.replace(/\{USER\}/g, from).replace("{ERA}", era);
  let newLine = `${now} ${roomAlias} ${confession}`;
  let commitMessage = `update from ${from}`;

  let done = false;
  try {
    let resp = await repo.contentsAsync(path);
    let sha = resp[0].sha;

    let content = Buffer.from(resp[0].content, "base64").toString();
    content += `\n${newLine}`;

    await repo.updateContentsAsync(path, commitMessage, content, sha);
    done = true;
  } catch (err) {
    if (err.statusCode && err.statusCode === 404) {
      // Create the file.
      await repo.createContentsAsync(path, commitMessage, newLine);
      done = true;
    } else {
      throw err;
    }
  }

  if (done) {
    await utils.sendSeen(client, msg);
    if (cooldown.check(msg.room)) {
      let split = userRepo.split("/");
      let user = split[0];
      let project = split[1];
      await client.sendText(
        msg.room,
        `Seen! Your update will eventually appear on https://${user}.github.io/${project}`
      );
      cooldown.didAnswer(msg.room);
    }
  }
}

module.exports = {
  handler,
  init,
  help:
    "Notes confessions on the mrgiggles/histoire repository. They'll eventually appear on https://mrgiggles.github.io/histoire."
};
