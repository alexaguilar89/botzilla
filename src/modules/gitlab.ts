import { request } from "../utils";
import * as settings from "../settings";
import * as _ from "../html";

const ISSUE_OR_MR_REGEXP = /(#|!)(\d+)/g;

async function handleIssueOrMr(
  client,
  baseUrl,
  user,
  project,
  roomId,
  isIssue,
  number
) {
  let encoded = `${user}%2F${project}`;
  let url = isIssue
    ? `https://${baseUrl}/api/v4/projects/${encoded}/issues/${number}`
    : `https://${baseUrl}/api/v4/projects/${encoded}/merge_requests/${number}`;
  let response = await request({
    uri: url,
    headers: {
      accept: "application/json",
      "user-agent": "curl/7.64.0" // oh you
    }
  });

  if (!response) {
    return;
  }

  if (response.statusCode !== 200) {
    console.warn("gitlab: error status code", response.statusCode);
    return;
  }

  let json = JSON.parse(response.body);
  if (!json) {
    return;
  }

  let text = `${json.title} | ${json.web_url}`;
  let html = _.a({ href: json.web_url }, json.title);

  client.sendMessage(roomId, {
    msgtype: "m.notice",
    body: text,
    format: "org.matrix.custom.html",
    formatted_body: html
  });
}

async function expandGitlab(client, msg) {
  let url = await settings.getOption(msg.room, "gitlab", "url");
  if (typeof url === "undefined") {
    return;
  }

  // Remove the protocol.
  if (url.startsWith("http://")) {
    url = url.split("http://")[1];
  } else if (url.startsWith("https://")) {
    url = url.split("https://")[1];
  }

  // Remove trailing slash, if it's there.
  if (url.endsWith("/")) {
    url = url.substr(0, url.length - 1);
  }

  // e.g.: gitlab.com/somebody/project
  let split = url.split("/");
  let project = split.pop();
  let user = split.pop();
  let baseUrl = split.join("/");

  var matches: RegExpExecArray | null = null;
  while ((matches = ISSUE_OR_MR_REGEXP.exec(msg.body)) !== null) {
    await handleIssueOrMr(
      client,
      baseUrl,
      user,
      project,
      msg.room,
      matches[1] === "#",
      matches[2]
    );
  }
}

module.exports = {
  handler: expandGitlab,
  help:
    "If configured for a specific Gitlab repository (via the 'url' set " +
    "option), in this room, will expand #123 into the issue's title and URL, " +
    "!123 into the MR's title and URL."
};
