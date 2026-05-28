import { create } from 'zustand'
import type { Asset } from './timelineStore'

interface AssetState {
  assets: Asset[]
}

interface AssetActions {
  addAsset: (asset: Asset) => void
  removeAsset: (id: string) => void
  updateThumbnail: (id: string, thumbnailPath: string) => void
}

export const useAssetStore = create<AssetState & AssetActions>((set) => ({
  assets: [],

  addAsset: (asset) =>
    set((state) => ({
      assets: state.assets.some((a) => a.id === asset.id) ? state.assets : [...state.assets, asset],
    })),

  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    })),

  updateThumbnail: (id, thumbnailPath) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, thumbnailPath } : a)),
    })),
}))
