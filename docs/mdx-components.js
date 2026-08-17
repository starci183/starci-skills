import {useMDXComponents as getThemeComponents} from "nextra-theme-docs";
import CodeUiTabs from "./src/components/CodeUiTabs";

const themeComponents = getThemeComponents();

export function useMDXComponents(components) {
  return {
    ...themeComponents,
    CodeUiTabs,
    ...components
  };
}
