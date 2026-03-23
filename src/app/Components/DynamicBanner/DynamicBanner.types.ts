export type BannerLayerType =
  | "background"
  | "canvas"
  | "image"
  | "text"
  | "animated"
  | "lottie"
  | "particles"
  | "group"
  | "components";

export type BannerBackground = {
  type?: string;
  value?: string;
  image?: string;
};

export type BannerAnimationConfig = {
  name?: string;
  duration?: string;
  delay?: string;
  easing?: string;
  timingFunction?: string;
  iterationCount?: string | number;
  fillMode?: string;
};

export type BannerLayer = {
  id?: string;
  type: BannerLayerType;
  visible?: boolean;

  // Background
  bgType?: "solid" | "gradient" | "image";
  value?: string;

  // Canvas / Particles
  effect?: "nodes" | "particles" | "hearts" | "rain" | "snow" | "fire" | "stars";
  intensity?: number;
  density?: number;
  color?: string;

  // Lottie
  source?: string;
  loop?: boolean;
  speed?: number;
  autoPlay?: boolean;

  // Content
  src?: string;
  alt?: string;
  content?: string;
  assetType?: "text" | "image" | "tag";
  tag?: string;
  fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  position?: string;

  // Styling & Animation
  styles?: Record<string, string | number>;
  imageStyles?: Record<string, string | number>;
  animation?: BannerAnimationConfig;
  components?: BannerLayer[];
  children?: BannerLayer[]; // Legacy
  mask?: string;
  media?: Record<string, Record<string, string | number>>;
  priority?: boolean;
  lcp?: boolean;
};

// Compatibilidad: algunos consumidores antiguos referencian este tipo.
export type BannerElementConfig = BannerLayer;

export type DashboardBannerConfig = {
  activeBannerId?: string;
  bannerTools?: {
    mode?: "manual" | "auto";
    autoplay?: boolean;
    intervalMs?: number;
    transition?: "fade" | "slide" | "zoom" | "none";
  };
  banner?: {
    id?: string;
    name?: string;
    order?: number;
    duration?: number;
    width?: string;
    height?: string;
    designWidth?: number;
    designHeight?: number;
    aspectRatio?: number | string;
    actionUrl?: string;
    background?: BannerBackground;
    styles?: Record<string, string | number>;
    elements?: BannerElementConfig[]; // Legacy
    layers?: BannerLayer[];
  };
  banners?: Array<DashboardBannerConfig["banner"]>;
  availableBanners?: Array<{
    id: string;
    name: string;
    order: number;
  }>;
  bannerItems?: Array<{
    id: string;
    name: string;
    order: number;
    banner: NonNullable<DashboardBannerConfig["banner"]>;
  }>;
};

export type BannerState = {
  status: "loading" | "ready" | "error" | "empty";
  config?: DashboardBannerConfig;
  reason?: string;
};

export type BannerMeta = {
  hasBanner: boolean;
  version: string | null;
  lastUpdated: number | null;
};

export type StorageAdapter = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};
