import {useMDXComponents as getThemeComponents} from "nextra-theme-docs";
import ArchetypeTemplatePreview from "./src/components/ArchetypeTemplatePreview";
import CodeUiTabs from "./src/components/CodeUiTabs";

const themeComponents = getThemeComponents();

export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ArchetypeTemplatePreview,
    CodeUiTabs,
    ...components
  };
}
