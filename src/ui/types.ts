export type Profile = {
  name: string;
  handle: string;
  tagline?: string;
  nav?: {
    title?: string;
  };
  accent?: string; // "270 95% 65%"
  publisherBaseUrl?: string; // Publisher API base URL (e.g. https://<worker>.workers.dev)
  avatarUrl?: string;
  avatarEmoji?: string;
  links?: Array<{ label: string; href: string }>;
  hero?: {
    title?: string;
    titleStyle?: "text" | "seal" | "cursive" | "stele";
    tagline?: string;
    variant?: "image" | "mimo"; // homepage hero style: image cover vs MiMo-style pattern + spotlight
    imageUrl?: string;
    preload?: boolean; // default true; preloads hero image on homepage
    blurPx?: number;
    opacity?: number;
    position?: string; // CSS object-position
    tintOpacity?: number; // 0..1, color tint overlay
    washOpacity?: number; // 0..1, paper wash / fog overlay
    saturate?: number; // CSS filter saturate()
    contrast?: number; // CSS filter contrast()
    textColor?: { light?: string; dark?: string }; // HSL string like "0 0% 100%"
    textScale?: number; // font scale multiplier; clamped (mimo: 0.85..1.6, image: 0.85..1.25)
    patternText?: string;
    patternStyle?: "text" | "seal" | "clerical" | "essay";
    patternOpacity?: number; // 0..1.5 (mimo only) overall visibility multiplier for background pattern
    patternScale?: number; // 0.7..1.4 (mimo only) scales pattern font sizes
    patternMotion?: "none" | "drift"; // (mimo only) subtle background drift animation
    spotlightSceneUrl?: string; // optional hidden scene revealed inside spotlight
    spotlightScenePosition?: string; // CSS object-position for spotlight scene
    spotlightSceneOpacity?: number; // 0..1 opacity for spotlight scene
    spotlightSceneScale?: number; // scales hidden scene slightly for depth
    spotlightRadiusPx?: number; // px radius for cursor spotlight (mimo only), clamped 88..520
    spotlightEase?: number; // (mimo only) 0.05..0.5 smoothing factor for spotlight follow
    spotlightEaseRadius?: number; // (mimo only) 0.05..0.5 smoothing factor for spotlight radius
  };
};

export type Category = {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "cyan" | "violet" | "lime" | "amber" | "rose";
  noteCount?: number;
};

export type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  updated: string;
  categories: string[];
  tags: string[];
  draft?: boolean;
  cover?: string;
};

export type Note = NoteListItem & {
  content: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  stack?: string[];
  highlights?: string[];
};
