/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BroadcastDaySchedule } from "../types";
import { putsDBValue, getDBValue, getAllDBValues, deleteDBValue } from "./IndexedDB";

export class BroadcastDay {
  // Retrieve schedule for a distinct dateKey (YYYY-MM-DD)
  static async getSchedule(dateKey: string): Promise<BroadcastDaySchedule | null> {
    const data = await getDBValue<BroadcastDaySchedule>("broadcastDays", dateKey);
    return data || null;
  }

  // Update or set schedule for a dateKey
  static async saveSchedule(schedule: BroadcastDaySchedule): Promise<void> {
    await putsDBValue("broadcastDays", schedule);
  }

  // Remove a schedule entry
  static async removeSchedule(dateKey: string): Promise<void> {
    await deleteDBValue("broadcastDays", dateKey);
  }

  // Get all schedules
  static async getAllSchedules(): Promise<BroadcastDaySchedule[]> {
    return await getAllDBValues<BroadcastDaySchedule>("broadcastDays");
  }

  // Determine which Broadcast Day a standard date/time belongs to based on the "dayStart" boundary.
  // E.g. If dayStart is "06:00" and currentTime is "02:30", it falls back to the previous calendar day.
  static getBroadcastDateKey(dateTime: Date, dayStartStr: string = "06:00"): string {
    const [startHour, startMin] = dayStartStr.split(":").map(Number);
    const date = new Date(dateTime.getTime());
    
    const curHour = date.getHours();
    const curMin = date.getMinutes();

    // If active hour is before the EPG boundary hour (or same hour but before minute)
    if (curHour < startHour || (curHour === startHour && curMin < startMin)) {
      // Moves date back by 1 day
      date.setDate(date.getDate() - 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // Initialize helper default schedules if empty
  static async initSampleSchedules(): Promise<void> {
    const existing = await this.getAllSchedules();
    if (existing.length === 0) {
      const today = new Date();
      const todayKey = this.getBroadcastDateKey(today);
      
      const sampleSchedule: BroadcastDaySchedule = {
        dateKey: todayKey,
        dayStart: "06:00",
        note: "[PLACEHOLDER] Default Syndicate Schedule Simulation",
        rules: "Standard 06:00 - 06:00 Broadcast Time Rule",
        scheduleItems: [
          {
            id: "s1",
            time: "06:00",
            title: "[PLACEHOLDER] Morning Syndicate Briefing",
            description: "Opening bulletins and early global summaries.",
          },
          {
            id: "s2",
            time: "12:00",
            title: "[PLACEHOLDER] Midday War Room Special",
            description: "Deep dive analyses and scheduled panel broadcasts.",
          },
          {
            id: "s3",
            time: "18:00",
            title: "[PLACEHOLDER] Alex Jones Show Primetime Replay",
            description: "High-definition coverage of the main syndicated stream event.",
          },
          {
            id: "s4",
            time: "23:00",
            title: "[PLACEHOLDER] Late Night Classic Loops & Shortwave Feed",
            description: "Nocturnal syndication transmission cycles.",
          }
        ],
      };

      await this.saveSchedule(sampleSchedule);
      console.log("[BroadcastDay] Initialized sample TV schedule for " + todayKey);
    }
  }
}
