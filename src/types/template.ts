export interface Template {
  id: string;
  name: string;
  description: string;
  preview: string; // emoji or icon
  layout: TemplateLayout;
  caption: CaptionStyle;
  overlay?: OverlayConfig;
}

export interface TemplateLayout {
  width: 1080;
  height: 1920;
  videoPosition: 'fill' | 'top' | 'center';
  videoScale: number; // 0-1, portion of height
  background: 'blur' | 'black' | 'gradient' | 'color';
  backgroundTint?: string; // hex color for tint
  blurRadius?: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string; // hex
  outlineColor: string;
  outlineWidth: number;
  shadowColor?: string;
  shadowOffset?: number;
  position: 'bottom' | 'center' | 'top';
  marginBottom: number;
  maxCharsPerLine: number;
  highlightColor?: string; // for current-word highlighting
  backgroundColor?: string; // text background box
}

export interface OverlayConfig {
  topBar?: {
    height: number;
    backgroundColor: string;
    textColor: string;
    fontSize: number;
  };
  bottomPanel?: {
    height: number;
    backgroundColor: string;
    textColor: string;
  };
  gradient?: {
    direction: 'top' | 'bottom';
    colors: string[];
    opacity: number;
  };
  border?: {
    color: string;
    width: number;
    glow?: boolean;
  };
}
