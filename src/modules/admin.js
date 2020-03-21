let settings = require("../settings");

// All the admin commands must start with !admin.

const ENABLE_REGEXP = /!admin (enable|disable) ([a-zA-Z-]+)/g;
const ENABLE_ALL_REGEXP = /!admin (enable|disable)-all ([a-zA-Z-]+)/g;

async function isAdmin(from, extra) {
  // At the moment, do something simple.
  return extra.owner === from;
}

async function enableForRoom(client, regexp, msg, room, extra) {
  regexp.lastIndex = 0;

  let match = regexp.exec(msg.body);
  if (match === null) {
    return false;
  }

  let enabled = match[1] === "enable";
  let moduleName = match[2];

  if (extra.handlerNames.indexOf(moduleName) === -1) {
    client.sendText(msg.room, "Unknown module.");
    return true;
  }

  await settings.enableModule(room, moduleName, enabled);

  let enabledText = match[1] + "d"; // heh
  let roomText = room === "*" ? "all the rooms" : "this room";
  client.sendText(
    msg.room,
    `The module ${moduleName} has been ${enabledText} in ${roomText}.`
  );

  return true;
}

async function tryEnable(client, msg, extra) {
  return enableForRoom(client, ENABLE_REGEXP, msg, msg.room, extra);
}

async function tryEnableAll(client, msg, extra) {
  return enableForRoom(client, ENABLE_ALL_REGEXP, msg, "*", extra);
}

async function tryList(client, msg, extra) {
  if (msg.body.trim() !== "!admin list") {
    return false;
  }
  let response = extra.handlerNames.join(", ");
  client.sendText(msg.room, response);
  return true;
}

async function tryEnabledStatus(client, msg, extra) {
  if (msg.body.trim() !== "!admin status") {
    return false;
  }

  let response = "";

  let status = await settings.getSettings();
  for (const roomId in status) {
    let roomText = roomId === "*" ? "all" : roomId;

    let enabledModules = Object.keys(status[roomId])
      .map(key => {
        if (
          typeof status[roomId] !== "undefined" &&
          typeof status[roomId][key] === "boolean"
        ) {
          return status[roomId][key] ? key : "!" + key;
        }
        return undefined;
      })
      .filter(x => x !== undefined);

    if (!enabledModules.length) {
      continue;
    }
    enabledModules = enabledModules.join(", ");

    response += `${roomText}: ${enabledModules}\n`;
  }

  if (!response.length) {
    return true;
  }

  client.sendText(msg.room, response);
  return true;
}

async function handler(client, msg, extra) {
  if (!msg.body.startsWith("!admin")) {
    return;
  }
  if (!(await isAdmin(msg.sender, extra))) {
    return;
  }
  if (await tryEnable(client, msg, extra)) {
    return;
  }
  if (await tryEnableAll(client, msg, extra)) {
    return;
  }
  if (await tryEnabledStatus(client, msg, extra)) {
    return;
  }
  if (await tryList(client, msg, extra)) {
    return;
  }
  client.sendText(
    msg.room,
    "unknown admin command; possible commands are: 'enable|disable|enable-all|disable-all|list|status.'"
  );
}

module.exports = {
  handler,
  help: `Helps administrator configure the current Botzilla instance.
    Possible commands are: enable (module)|disable (module)|enable-all (module)|disable-all (module)|list|status`
};
