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
  loadAssets: (assets: Asset[]) => void
  clearAssets: () => void
}

function revokeAssetUrls(asset: Asset): void {
  if (typeof URL === 'undefined') return
  const urls = [asset.path, asset.thumbnailPath].filter(
    (url): url is string => typeof url === 'string' && url.startsWith('blob:')
  )
  for (const url of new Set(urls)) {
    URL.revokeObjectURL(url)
  }
}

export const useAssetStore = create<AssetState & AssetActions>((set) => ({
  assets: [],
  selectedAssetId: null,

  addAsset: (asset) =>
    set((state) => ({
      // id 또는 path 기준 중복 방지 (StrictMode 이중 호출, 동일 파일 재드롭 대비)
      assets: state.assets.some((a) => a.id === asset.id || a.path === asset.path)
        ? state.assets
        : [...state.assets, asset],
    })),

  removeAsset: (id) =>
    set((state) => {
      const asset = state.assets.find((a) => a.id === id)
      if (asset) revokeAssetUrls(asset)
      return {
        assets: state.assets.filter((a) => a.id !== id),
        selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
      }
    }),

  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  updateThumbnail: (id, thumbnailPath) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, thumbnailPath } : a)),
    })),

  setSelectedAsset: (id) => set({ selectedAssetId: id }),

  loadAssets: (assets) =>
    set((state) => {
      for (const asset of state.assets) {
        if (!assets.some((nextAsset) => nextAsset.path === asset.path)) revokeAssetUrls(asset)
      }
      return { assets, selectedAssetId: null }
    }),

  clearAssets: () =>
    set((state) => {
      for (const asset of state.assets) revokeAssetUrls(asset)
      return { assets: [], selectedAssetId: null }
    }),
}))
