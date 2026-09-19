#!/usr/bin/env node

const fs = require("fs");
const { pipeline } = require("stream/promises");

const [core, version, ram] = process.argv.slice(2);

const api_link = {
  vanilla: "https://launchermeta.mojang.com/mc/game/version_manifest.json",
  paper: "https://fill.papermc.io/v3/projects/paper",
  purpur: "https://api.purpurmc.org/v2/purpur",
};

if (core === "-h" || core === "--help" || !core) {
  console.log("Usage: msc <core> <version> <ram>");
  console.log("Example: msc paper 1.20.4 4G");
  process.exit(0);
}

function getVanillaUrl(version) {
  return fetch(api_link.vanilla)
    .then((responce) => responce.json())
    .then((data) => {
      const info = data.versions.find((item) => item.id === version);
      if (!info) {
        console.log(`Error: version ${version} not found`);
        process.exit(1);
      }
      return info;
    })
    .then((info) => fetch(info.url))
    .then((responce) => responce.json())
    .then((data) => data.downloads.server.url);
}

function getPaperUrl(version) {
  return fetch(`${api_link.paper}/versions/${version}/builds`)
    .then((responce) => responce.json())
    .then((ids) => {
      if (ids.ok === false) {
        console.log(`Error: version ${version} not found`);
        process.exit(1);
      }
      return ids[0].id;
    })
    .then((latestId) =>
      fetch(`${api_link.paper}/versions/${version}/builds/${latestId}`),
    )
    .then((responce) => responce.json())
    .then((data) => data.downloads["server:default"].url);
}

function getPurpurUrl(version) {
  return fetch(`${api_link.purpur}/${version}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.builds) {
        console.log(`Error: version ${version} not found`);
        process.exit(1);
      }
      const latestBuild = data.builds.latest;
      return `${api_link.purpur}/${version}/${latestBuild}/download`;
    });
}

function downloadCore(coreName, version, getUrlFn) {
  getUrlFn(version)
    .then((downloadUrl) => {
      console.log(`Downloading ${coreName}...`);
      return fetch(downloadUrl);
    })
    .then((response) => {
      if (response.status !== 200) {
        console.log(`Error downloading: server return code ${response.status}`);
        process.exit(1);
      }
      return pipeline(response.body, fs.createWriteStream(`${coreName}.jar`));
    })
    .then(() => console.log(`${coreName}.jar download successful`))
    .then(() => {
      createStartSh(coreName);
      createEulaTxt();
    })
    .catch((error) => console.error("Error downloading:", error));
}

function createStartSh(coreName) {
  const GbToMb = parseInt(ram) * 1024;
  if (process.platform === "win32") {
    fs.writeFileSync(
      "start.bat",
      `java -Xms${GbToMb}M -Xmx${GbToMb}M --add-modules=jdk.incubator.vector -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -jar ${coreName}.jar nogui`,
    );
  } else {
    fs.writeFileSync(
      "start.sh",
      `#!/bin/bash
java -Xms${GbToMb}M -Xmx${GbToMb}M --add-modules=jdk.incubator.vector -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -jar ${coreName}.jar nogui`,
    );
    fs.chmodSync("start.sh", 0o755);
  }
}

function createEulaTxt() {
  fs.writeFileSync("eula.txt", "eula=true");
}

switch (core) {
  case "vanilla":
    console.log(`Vanilla ${version} has been selected`);
    downloadCore("vanilla", version, getVanillaUrl);
    break;
  case "paper":
    console.log(`Paper ${version} has been selected`);
    downloadCore("paper", version, getPaperUrl);
    break;
  case "purpur":
    console.log(`Purpur ${version} has been selected`);
    downloadCore("purpur", version, getPurpurUrl);
    break;
  default:
    console.log(`Unknown core ${core}`);
    process.exit(1);
}
