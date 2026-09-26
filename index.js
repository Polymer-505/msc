#!/usr/bin/env node

const fs = require("fs");
const child_process = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const cliProgress = require("cli-progress");
const pc = require("picocolors");

// Arguments
const [kernel, version, ram] = process.argv.slice(2);

// Link to the kernels api
const api_link = {
  vanilla: "https://launchermeta.mojang.com/mc/game/version_manifest.json",
  paper: "https://fill.papermc.io/v3/projects/paper",
  purpur: "https://api.purpurmc.org/v2/purpur",
  fabric: "https://meta.fabricmc.net/v2/versions",
  forge: "https://files.minecraftforge.net/net/minecraftforge/forge",
};

// Open help
if (kernel === "-help" || !kernel) {
  console.log("Usage: msc <kernel> <version> <ram>");
  console.log("Example: msc paper 1.20.4 4G");
  console.log("Available commands: -help, -list");
  process.exit(0);
}

// List kernels
if (kernel === "-list") {
  console.log("Available kernels: vanilla, paper, purpur, fabric, forge");
  process.exit(0);
}

// Validate required arguments
if (!version || !ram) {
  console.log(pc.red("Error: missing required arguments"));
  console.log("Usage: msc <kernel> <version> <ram>");
  process.exit(1);
}

// Validate ram format (e.g. "4G" or "4096M")
const ramMatch = ram.match(/^(\d+)([GM])$/i);
if (!ramMatch) {
  console.log(
    pc.red(`Error: invalid ram format "${ram}", expected e.g. "4G" or "4096M"`),
  );
  process.exit(1);
}

// Get vanilla kernel link
function getVanillaUrl(version) {
  return fetch(api_link.vanilla)
    .then((response) => response.json())
    .then((data) => {
      const info = data.versions.find((item) => item.id === version);
      if (!info) {
        console.log(pc.red(`Error: version ${version} not found`));
        process.exit(1);
      }
      return info;
    })
    .then((info) => fetch(info.url))
    .then((response) => response.json())
    .then((data) => data.downloads.server.url);
}

// Get paper kernel link
function getPaperUrl(version) {
  return fetch(`${api_link.paper}/versions/${version}/builds`)
    .then((response) => response.json())
    .then((ids) => {
      if (ids.ok === false) {
        console.log(pc.red(`Error: version ${version} not found`));
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

// Get purpur kernel link
function getPurpurUrl(version) {
  return fetch(`${api_link.purpur}/${version}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.builds) {
        console.log(pc.red(`Error: version ${version} not found`));
        process.exit(1);
      }
      const latestBuild = data.builds.latest;
      return `${api_link.purpur}/${version}/${latestBuild}/download`;
    });
}

// Get fabric kernel link
function getFabricUrl(version) {
  return Promise.all([
    fetch(`${api_link.fabric}/loader/${version}`).then((response) =>
      response.json(),
    ),
    fetch(`${api_link.fabric}/installer`).then((response) => response.json()),
  ]).then(([loaderData, installerData]) => {
    if (!loaderData || loaderData.length === 0) {
      console.log(pc.red(`Error: version ${version} not found`));
      process.exit(1);
    }
    const latestBuild = loaderData[0].loader.version;
    const installerVersion = installerData[0].version;
    return `${api_link.fabric}/loader/${version}/${latestBuild}/${installerVersion}/server/jar`;
  });
}

// Get forge kernel link
function getForgeUrl(version) {
  return fetch(`${api_link.forge}/promotions_slim.json`)
    .then((response) => response.json())
    .then((data) => {
      const latestBuild = data.promos[`${version}-latest`];
      if (!latestBuild) {
        console.log(pc.red(`Error: version ${version} not found`));
        process.exit(1);
      }
      return `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${latestBuild}/forge-${version}-${latestBuild}-installer.jar`;
    });
}

// Create start.sh or start.bat
function createStartSh(kernelName) {
  const ramMatch = ram.match(/^(\d+)([GM])$/i);
  const [, amount, unit] = ramMatch;
  const ramInMb =
    unit.toUpperCase() === "G" ? parseInt(amount) * 1024 : parseInt(amount);

  if (process.platform === "win32") {
    fs.writeFileSync(
      "start.bat",
      `java -Xms${ramInMb}M -Xmx${ramInMb}M --add-modules=jdk.incubator.vector -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -jar ${kernelName}.jar nogui`,
    );
    console.log("File start.bat created successful");
  } else {
    fs.writeFileSync(
      "start.sh",
      `#!/bin/bash
java -Xms${ramInMb}M -Xmx${ramInMb}M --add-modules=jdk.incubator.vector -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -jar ${kernelName}.jar nogui`,
    );
    fs.chmodSync("start.sh", 0o755);
    console.log(pc.green("File start.sh created successful"));
  }
}

// Create eula.txt
function createEulaTxt() {
  fs.writeFileSync("eula.txt", "eula=true");
  console.log(pc.green("File eula.txt created successful"));
}

function downloadKernel(kernelName, version, getUrlFn) {
  getUrlFn(version)
    .then((downloadUrl) => {
      console.log(`Downloading ${kernelName}...`);
      return fetch(downloadUrl);
    })
    .then((response) => {
      if (response.status !== 200) {
        console.log(
          pc.red(`Error downloading: server return code ${response.status}`),
        );
        process.exit(1);
      }
      const totalSize =
        parseInt(response.headers.get("content-length"), 10) || 0;
      const progressBar = new cliProgress.SingleBar(
        {},
        cliProgress.Presets.shades_classic,
      );
      progressBar.start(totalSize, 0);

      const nodeStream = Readable.fromWeb(response.body);
      nodeStream.on("data", (chunk) => {
        progressBar.increment(chunk.length);
      });

      return pipeline(
        nodeStream,
        fs.createWriteStream(`${kernelName}.jar`),
      ).then(() => progressBar.stop());
    })
    .then(() => console.log(pc.green(`${kernelName}.jar download successful`)))
    .then(() => {
      if (kernelName === "forge") {
        console.log("Starting the forge installation");
        child_process.execSync("java -jar forge.jar --installServer", {
          stdio: "inherit",
        });
        fs.rmSync("forge.jar");
        fs.rmSync("forge.jar.log", { force: true });
      } else {
        createStartSh(kernelName);
      }
      createEulaTxt();
    })
    .catch((error) => {
      console.error(pc.red("Error downloading:"), error);
      process.exit(1);
    });
}

switch (kernel) {
  case "vanilla":
    console.log(`Vanilla ${version} has been selected`);
    downloadKernel("vanilla", version, getVanillaUrl);
    break;
  case "paper":
    console.log(`Paper ${version} has been selected`);
    downloadKernel("paper", version, getPaperUrl);
    break;
  case "purpur":
    console.log(`Purpur ${version} has been selected`);
    downloadKernel("purpur", version, getPurpurUrl);
    break;
  case "fabric":
    console.log(`Fabric ${version} has been selected`);
    downloadKernel("fabric", version, getFabricUrl);
    break;
  case "forge":
    console.log(`Forge ${version} has been selected`);
    downloadKernel("forge", version, getForgeUrl);
    break;
  default:
    console.log(pc.red(`Unknown kernel ${kernel}`));
    process.exit(1);
}
