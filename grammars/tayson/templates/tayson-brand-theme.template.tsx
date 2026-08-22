export const TaysonThemeBoundary = ({ children }: { children: unknown }) => (
  <div data-theme="tayson" data-brand-surface="shared">{children as never}</div>
)
