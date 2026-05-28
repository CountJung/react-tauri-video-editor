import { create } from 'zustand'
import type { Asset } from './timelineStore'

interface AssetState {
  assets: Asset[]
  selectedAssetId: string | null
}

interface AssetActions {
  addAsset: (asset: Asset) => void
  removeAsset: (id: string) => void
  updateAsset: (id: string, updates: Partial<Asset>) => void
  updateThumbnail: (id: string, thumbnailPath: string) => void
  setSelectedAsset: (id: string | null) => void
}

export const useAssetStore = create<AssetState & AssetActions>((set) => ({
  assets: [],
  selectedAssetId: null,

  addAsset: (asset) =>
    set((state) => ({
      assets: state.assets.some((a) => a.id === asset.id) ? state.assets : [...state.assets, asset],
    })),

  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    })),

  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  updateThumbnail: (id, thumbnailPath) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, thumbnailPath } : a)),
    })),

  setSelectedAsset: (id) => set({ selectedAssetId: id }),
}))
