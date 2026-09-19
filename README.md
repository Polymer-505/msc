# msc (Minecraft Server Creator)

Command-line tool for downloading Vanilla, Paper, and Purpur Minecraft server jars.

<p align="center">
  <video src="./cli-preview.mp4" width="800" controls autoplay loop muted></video>
</p>

## Features

- Downloads server cores directly from official sources (`vanilla`, `paper`, `purpur`).
- Automatically generates `eula.txt`.
- Creates launch scripts (`start.sh` for Linux or `start.bat` for Windows) with pre-configured **Aikar's Flags**.
- Auto-detects OS platform to generate the correct executable script.

## Usage

Run `msc` by specifying the core, Minecraft version, and allocated RAM:

```bash
msc <core> <version> <ram>
```

## Examples

- Vanilla

```bash
msc vanilla 1.21.11 2G
```

- Paper

```bash
msc paper 1.19.2 5G
```

- Purpur

```bash
msc purpur 26.2 4G
```

## Building from Source

If you want to compile `msc` into a standalone executable file, use `@yao-pkg/pkg`:

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build executables:**

- For Windows (msc.exe)

```bash
   npm run build:win
```

- For linux (msc)

```bash
   npm run build
```
