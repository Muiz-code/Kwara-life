// The "Place your ad here" boards on empty plots in the town on screen, so the booking form can offer them
// all and let the advertiser pick which plot. Filled in by the 3D town when it builds; not saved.
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export interface PlotBoard {
  id: string;
  /** Where it is, for the picker: "By the Supermart". */
  label: string;
}

export const plotBoardsStore = createStore<{ mapId: string | null; boards: PlotBoard[] }>(() => ({ mapId: null, boards: [] }));

export const usePlotBoards = () => useStore(plotBoardsStore, (s) => s.boards);
