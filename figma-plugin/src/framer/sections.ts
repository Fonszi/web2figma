/**
 * Framer sections — organize top-level Framer sections into Figma Section nodes.
 *
 * Framer pages have clear section boundaries (Hero, Features, CTA, Footer)
 * identified by `data-framer-name` on top-level children.
 * This module wraps those in Figma Sections for better layer organization.
 *
 * Related files:
 * - Naming: figma-plugin/src/framer/naming.ts (isFramerSection)
 * - Converter: figma-plugin/src/converter.ts
 */

import type { BridgeNode } from '../../../shared/types';
import { isFramerSection, getFramerName } from './naming';

/**
 * Organize top-level children of pageFrame into Figma Sections.
 *
 * Walks pageFrame.children in parallel with rootNode.children.
 * For each rootNode child that is a Framer section, wraps the
 * corresponding Figma child in a Section node.
 *
 * Returns the number of sections created.
 */
export function organizeFramerSections(
  pageFrame: FrameNode,
  rootNode: BridgeNode,
): number {
  // Figma children and BridgeNode children should be in the same order
  const figmaChildren = [...pageFrame.children];
  const bridgeChildren = rootNode.children;

  // Safety: if counts don't match, skip (tree was modified by component instances etc.)
  if (figmaChildren.length !== bridgeChildren.length) return 0;

  let sectionCount = 0;

  // Process in reverse order to preserve indices when moving nodes
  for (let i = bridgeChildren.length - 1; i >= 0; i--) {
    const bridgeChild = bridgeChildren[i]!;
    const figmaChild = figmaChildren[i];

    if (!figmaChild) continue;
    if (!isFramerSection(bridgeChild)) continue;

    const sectionName = getFramerName(bridgeChild);
    if (!sectionName) continue;

    try {
      const section = figma.createSection();
      section.name = sectionName;

      // Position and size the section to match the child
      if ('x' in figmaChild && 'y' in figmaChild) {
        section.x = (figmaChild as SceneNode & { x: number }).x;
        section.y = (figmaChild as SceneNode & { y: number }).y;
      }
      if ('width' in figmaChild && 'height' in figmaChild) {
        section.resizeSansConstraints(
          (figmaChild as SceneNode & { width: number }).width,
          (figmaChild as SceneNode & { height: number }).height,
        );
      }

      // Move the figma child into the section
      section.appendChild(figmaChild);

      // Insert the section into the page frame at the same position
      pageFrame.insertChild(i, section);

      sectionCount++;
    } catch {
      // figma.createSection() may not be available in all API versions
    }
  }

  return sectionCount;
}
