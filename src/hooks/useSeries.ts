/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { TVShowSeries } from "../types";
import { SeriesService } from "../services/Series";

export function useSeries() {
  const [seriesList, setSeriesList] = useState<TVShowSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAllSeries = useCallback(async () => {
    setLoading(true);
    try {
      await SeriesService.initSampleSeries();
      const list = await SeriesService.getAllSeries();
      setSeriesList(list);
    } catch (e) {
      console.error("Failed to load show series:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllSeries();
  }, [fetchAllSeries]);

  const createGroupedSeries = useCallback(async (
    name: string,
    season: number,
    episodes: Array<{ title: string; url: string; dateKey?: string }>
  ) => {
    try {
      const created = await SeriesService.createSeriesFromEpisodes(name, season, episodes);
      await fetchAllSeries();
      return created;
    } catch (e) {
      console.error("Failed to compile grouped series:", e);
      throw e;
    }
  }, [fetchAllSeries]);

  const removeSeries = useCallback(async (id: string) => {
    try {
      await SeriesService.removeSeries(id);
      await fetchAllSeries();
    } catch (e) {
      console.error("Failed to delete series:", e);
    }
  }, [fetchAllSeries]);

  const loadSeriesDetails = useCallback(async (id: string) => {
    try {
      return await SeriesService.getSeriesById(id);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  return {
    seriesList,
    loading,
    createGroupedSeries,
    removeSeries,
    loadSeriesDetails,
    getNextEpisode: SeriesService.getNextEpisode,
    getPreviousEpisode: SeriesService.getPreviousEpisode,
    reloadSeries: fetchAllSeries,
  };
}
