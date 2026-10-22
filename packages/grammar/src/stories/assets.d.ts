// The stories import their image assets as URLs: Storybook's Vite builder serves them, and this declaration types the
// import for tsconfig.stories.json, which carries no bundler client types.
declare module '*.png' {
  const url: string;
  export default url;
}
