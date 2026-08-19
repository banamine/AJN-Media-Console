/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WatchedFolder, IPTVChannel } from "../types";
import { putsDBValue, getDBValue, getAllDBValues, deleteDBValue } from "./IndexedDB";
import { PlaylistVault } from "./PlaylistVault";

export class FolderWatcher {
  // Get all registered watched paths
  static async getWatchedFolders(): Promise<WatchedFolder[]> {
    return await getAllDBValues<WatchedFolder>("watchedFolders");
  }

  // Register a path to watch
  static async watchFolder(path: string, autoPoll: boolean = false): Promise<WatchedFolder> {
    const id = `folder-${path.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const newFolder: WatchedFolder = {
      id,
      path,
      lastScanned: new Date().toISOString(),
      autoPoll,
      fileCount: 0,
      status: "Initialized",
    };
    await putsDBValue("watchedFolders", newFolder);
    return newFolder;
  }

  // Stop watching a path
  static async unwatchFolder(id: string): Promise<void> {
    await deleteDBValue("watchedFolders", id);
  }

  // Update a folder configuration
  static async saveFolder(folder: WatchedFolder): Promise<void> {
    await putsDBValue("watchedFolders", folder);
  }

  // Scan a path - pulls back mock corporate feeds or parses remote listings to simulate file indexing
  static async forceScan(id: string): Promise<IPTVChannel[]> {
    const folder = await getDBValue<WatchedFolder>("watchedFolders", id);
    if (!folder) return [];

    folder.status = "Scanning...";
    await this.saveFolder(folder);

    // Simulate short filesystem scan delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate high quality mock feeds based on path name to make scan highly interactive and realistic
    const scanPath = folder.path.toLowerCase();
    const generatedChannels: IPTVChannel[] = [];

    if (scanPath.includes("news") || scanPath.includes("live") || scanPath.includes("/")) {
      generatedChannels.push({
        name: `[Local Watch] ${folder.path} - Rumble Action Live`,
        url: "",
        logo: "https://rumble.com/favicon.ico",
        group: "Scan output: " + folder.path,
        duration: -1,
        contentType: "live",
        category: ["Folder Search", "Live"],
        playCount: 0,
      });
    }

    if (scanPath.includes("test") || scanPath.includes("vod") || scanPath.includes("demo")) {
      generatedChannels.push({
        name: `[Local Watch] ${folder.path} - Deluxe Demo Stream`,
        url: "",
        logo: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Comedy_Central_logo_2018.svg",
        group: "Scan output: " + folder.path,
        duration: 240,
        contentType: "vod",
        category: ["Folder Search", "VOD"],
        playCount: 0,
      });
    }

    if (generatedChannels.length === 0) {
      // Fallback channel to guarantee success
      generatedChannels.push({
        name: `[Local Watch] Index Feed (${folder.path})`,
        url: "",
        logo: "https://rumble.com/favicon.ico",
        group: "Custom Folders",
        duration: -1,
        contentType: "live",
        category: ["Folder Search"],
        playCount: 0,
      });
    }

    // Add generated channels to general vault
    await PlaylistVault.addAndSyncChannels(generatedChannels);

    // Update watch folder metadata
    folder.lastScanned = new Date().toISOString();
    folder.fileCount = generatedChannels.length;
    folder.status = "Active (" + generatedChannels.length + " files mapped)";
    await this.saveFolder(folder);

    return generatedChannels;
  }

  // Pre-seed mock directories for local file explorers
  static async initSampleFolders(): Promise<void> {
    const folders = await this.getWatchedFolders();
    if (folders.length === 0) {
      await this.watchFolder("/home/usr/media/syndicated_news", true);
      await this.watchFolder("/home/usr/media/local_test_streams", false);
      const list = await this.getWatchedFolders();
      // Auto-scan first item
      if (list[0]) {
        await this.forceScan(list[0].id);
      }
      console.log("[FolderWatcher] Seeded virtual monitoring folders successfully");
    }
  }
}
