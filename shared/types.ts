// ============================================================
// Bridge Format — The contract between Chrome Extension and Figma Plugin.
// Extension creates BridgeNode JSON, Plugin consumes it.
//
// DO NOT CHANGE without updating both:
//   - extension/src/content/extractor.ts (produces)
//   - figma-plugin/src/converter.ts (consumes)
// ============================================================

export interface BridgeNode {
  tag: string;
  type: 'frame' | 'text' | 'image' | 'svg' | 'input' | 'video' | 'unknown';
  children: BridgeNode[];
  text?: string;
  styles: ComputedStyles;
  layout: LayoutInfo;
  bounds: BoundingBox;
  imageUrl?: string;
  imageDataUri?: string;       // Small images (<100KB) inlined as data URI
  svgData?: string;
  componentHash?: string;      // From extension/src/content/component-hasher.ts
  classNames?: string[];
  ariaRole?: string;
  dataAttributes?: Record<string, string>;  // data-framer-* etc.
  visible: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputedStyles {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  display?: string;
  position?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  alignSelf?: string;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  borderRadius?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderWidth?: string;
  borderStyle?: string;
  boxShadow?: string;
  opacity?: string;
  overflow?: string;
  backgroundImage?: string;
  transform?: string;
  cssVariables?: Record<string, string>;
}

export interface LayoutInfo {
  isAutoLayout: boolean;
  direction: 'horizontal' | 'vertical' | 'none';
  wrap: boolean;
  gap: number;
  padding: Spacing;
  sizing: { width: 'fixed' | 'hug' | 'fill'; height: 'fixed' | 'hug' | 'fill' };
  mainAxisAlignment: 'start' | 'center' | 'end' | 'space-between';
  crossAxisAlignment: 'start' | 'center' | 'end' | 'stretch';
}

export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================================
// Design Tokens — Extracted by extension/src/content/token-scanner.ts
// Created as Figma styles by figma-plugin/src/tokens/
// ============================================================

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  effects: EffectToken[];
  variables: VariableToken[];
}

export interface ColorToken {
  name: string;
  value: string;
  usageCount: number;
  cssVariable?: string;
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  usageCount: number;
}

export interface EffectToken {
  name: string;
  type: 'drop-shadow' | 'inner-shadow' | 'blur';
  value: string;
  usageCount: number;
}

export interface VariableToken {
  name: string;
  cssProperty: string;
  resolvedValue: string;
  type: 'color' | 'number' | 'string';
}

// ============================================================
// Component Detection — Hashed by extension/src/content/component-hasher.ts
// Created as Figma components by figma-plugin/src/components/
// ============================================================

export interface DetectedComponent {
  hash: string;
  name: string;
  instances: BridgeNode[];
  representativeNode: BridgeNode;
}

// ============================================================
// Extraction Result — Full output from Chrome Extension
// ============================================================

export interface ExtractionResult {
  url: string;
  viewport: { width: number; height: number };
  timestamp: number;
  framework: 'framer' | 'generic' | 'webflow' | 'wordpress' | 'unknown';
  rootNode: BridgeNode;
  tokens: DesignTokens;
  components: DetectedComponent[];
  fonts: DetectedFont[];
  metadata: SiteMetadata;
}

export interface DetectedFont {
  family: string;
  weights: number[];
  isGoogleFont: boolean;
  figmaEquivalent?: string;
}

export interface SiteMetadata {
  title: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  isFramerSite: boolean;
  framerProjectId?: string;
}

// ============================================================
// Import Settings — Stored in Figma clientStorage
// ============================================================

export interface ImportSettings {
  createStyles: boolean;
  createComponents: boolean;
  createVariables: boolean;
  framerAwareMode: boolean;
  includeHiddenElements: boolean;
  maxDepth: number;
  imageQuality: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: ImportSettings = {
  createStyles: true,
  createComponents: true,
  createVariables: true,
  framerAwareMode: true,
  includeHiddenElements: false,
  maxDepth: 50,
  imageQuality: 'high',
};
