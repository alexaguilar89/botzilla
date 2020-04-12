import * as sqlite from "sqlite";
import * as path from "path";

let db;

export async function init(storageDir) {
  let dbPath = path.join(storageDir, "db.sqlite");
  db = await sqlite.open(dbPath, { promise: Promise, verbose: true });
  db.on("trace", event => console.log(event));
  await db.migrate();
}

export async function upsertModuleSettingEnabled(roomId, moduleName, enabled) {
  let former = await db.get(
    "SELECT id FROM ModuleSetting WHERE matrixRoomId = ? AND moduleName = ?",
    roomId,
    moduleName
  );
  if (typeof former === "undefined") {
    await db.run(
      "INSERT INTO ModuleSetting (matrixRoomId, moduleName, enabled) VALUES (?, ?, ?)",
      roomId,
      moduleName,
      enabled
    );
  } else {
    await db.run(
      "UPDATE ModuleSetting SET enabled = ? where id = ?",
      enabled,
      former.id
    );
  }
}

export async function upsertModuleSettingOptions(roomId, moduleName, options) {
  let stringified = JSON.stringify(options);
  let former = await db.get(
    "SELECT id FROM ModuleSetting WHERE matrixRoomId = ? AND moduleName = ?",
    roomId,
    moduleName
  );
  if (typeof former === "undefined") {
    await db.run(
      "INSERT INTO ModuleSetting (matrixRoomId, moduleName, enabled, options) VALUES (?, ?, ?, ?)",
      roomId,
      moduleName,
      false /*enabled*/,
      stringified
    );
  } else {
    await db.run(
      "UPDATE ModuleSetting SET options = ? where id = ?",
      stringified,
      former.id
    );
  }
}

export async function getModuleSettings() {
  let results = await db.all(
    "SELECT moduleName, matrixRoomId, enabled, options FROM ModuleSetting;"
  );
  return results;
}
