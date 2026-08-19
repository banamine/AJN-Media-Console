/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { BroadcastDaySchedule } from "../types";
import { BroadcastDay } from "../services/BroadcastDay";

export function useBroadcastDay(initialDateKey?: string) {
  const [schedules, setSchedules] = useState<BroadcastDaySchedule[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<BroadcastDaySchedule | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string>(initialDateKey || BroadcastDay.getBroadcastDateKey(new Date()));
  const [loading, setLoading] = useState<boolean>(true);

  const reloadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      await BroadcastDay.initSampleSchedules();
      const all = await BroadcastDay.getAllSchedules();
      setSchedules(all);

      const current = await BroadcastDay.getSchedule(activeDateKey);
      setCurrentSchedule(current);
    } catch (e) {
      console.error("Failed to load electronic schedules:", e);
    } finally {
      setLoading(false);
    }
  }, [activeDateKey]);

  useEffect(() => {
    reloadSchedules();
  }, [reloadSchedules]);

  const selectDateKey = useCallback((dateKey: string) => {
    setActiveDateKey(dateKey);
  }, []);

  const saveDaySchedule = useCallback(async (sched: BroadcastDaySchedule) => {
    try {
      await BroadcastDay.saveSchedule(sched);
      await reloadSchedules();
    } catch (e) {
      console.error("Failed to save schedule:", e);
    }
  }, [reloadSchedules]);

  const removeDaySchedule = useCallback(async (dateKey: string) => {
    try {
      await BroadcastDay.removeSchedule(dateKey);
      await reloadSchedules();
    } catch (e) {
      console.error("Failed to prune schedule:", e);
    }
  }, [reloadSchedules]);

  return {
    schedules,
    currentSchedule,
    activeDateKey,
    loading,
    selectDateKey,
    saveDaySchedule,
    removeDaySchedule,
    getBroadcastDateKey: BroadcastDay.getBroadcastDateKey,
    reloadBroadcastDay: reloadSchedules,
  };
}
