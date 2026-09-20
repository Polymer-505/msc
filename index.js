#!/usr/bin/env node

const fs = require("fs");
const child_process = require("child_process");
const { pipeline } = require("stream/promises");

const [core, version, ram] = process.argv.slice(2);

const api_link = {
  vanilla: "https://launchermeta.mojang.com/mc/game/version_manifest.json",
  paper: "https://fill.papermc.io/v3/projects/paper",
  purpur: "https://api.purpurmc.org/v2/purpur",
  fabric: "https://meta.fabricmc.net/v2/versions",
  forge: "https://files.minecraftforge.net/net/minecraftforge/forge",
};

if (core === "-h" || core === "--help" || !core) {
  console.log("Usage: msc <core> <version> <ram>");
  console.log("Example: msc paper 1.20.4 4G");
  process.exit(0);
}

function getVanillaUrl(version) {
  return fetch(api_link.vanilla)
    .then((response) => response.json())
    .then((data) => {
      const info = data.versions.find((item) => item.id === version);
      if (!info) {
        console.log(`Error: version ${version} not found`);
        process.exit(1);
      }
      return info;
    })
    .then((info) => fetch(info.url))
    .then((response) => response.json())
    .then((data) => data.downloads.server.url);
}

function getPaperUrl(version) {
  return fetch(`${api_link.paper}/versions/${version}/builds`)
    .then((response) => response.json())
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
    .then((response) => response.json())
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

function getFabricUrl(version) {
  return Promise.all([
    fetch(`${api_link.fabric}/loader/${version}`).then((response) =>
      response.json(),
    ),
    fetch(`${api_link.fabric}/installer`).then((response) => response.json()),
  ]).then(([loaderData, installerData]) => {
    if (!loaderData || loaderData.length === 0) {
      console.log(`Error: version ${version} not found`);
      process.exit(1);
    }
    const latestBuild = loaderData[0].loader.version;
    const installerVersion = installerData[0].version;
    return `${api_link.fabric}/loader/${version}/${latestBuild}/${installerVersion}/server/jar`;
  });
}

function getForgeUrl(version) {
  return fetch(`${api_link.forge}/promotions_slim.json`)
    .then((response) => response.json())
    .then((data) => {
      const latestBuild = data.promos[`${version}-latest`];
      if (!latestBuild) {
        console.log(`Error: version ${version} not found`);
        process.exit(1);
      }
      return `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${latestBuild}/forge-${version}-${latestBuild}-installer.jar`;
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
      if (coreName === "forge") {
        console.log("Starting the forge installation");
        child_process.execSync("java -jar forge.jar --installServer", {
          stdio: "inherit",
        });
        fs.rmSync("forge.jar");
        fs.rmSync("forge.jar.log", { force: true });
      } else {
        createStartSh(coreName);
      }
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
  case "fabric":
    console.log(`Fabric ${version} has been selected`);
    downloadCore("fabric", version, getFabricUrl);
    break;
  case "forge":
    console.log(`Forge ${version} has been selected`);
    downloadCore("forge", version, getForgeUrl);
    break;
  default:
    console.log(`Unknown core ${core}`);
    process.exit(1);
}
