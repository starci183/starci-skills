import styles from "./styles.module.css";

const TEMPLATE_ASSET_PATTERN = /^\/template-assets\/archetypes\/[a-z0-9-]+(?:\/[a-z0-9-]+)+\/template\.html$/;

export default function ArchetypeTemplatePreview({src, title}) {
  if (typeof src !== "string" || !TEMPLATE_ASSET_PATTERN.test(src)) {
    return (
      <div className={styles.invalid} role="alert">
        Invalid archetype template asset path.
      </div>
    );
  }

  const accessibleTitle = typeof title === "string" && title.trim()
    ? title
    : "Responsive archetype template";

  return (
    <figure className={styles.root}>
      <figcaption className={styles.toolbar}>
        <span>Interactive responsive template</span>
        <a href={src} target="_blank" rel="noopener noreferrer">
          Open full page
        </a>
      </figcaption>
      <div className={styles.viewport}>
        <iframe
          className={styles.frame}
          src={src}
          title={accessibleTitle}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
        />
      </div>
    </figure>
  );
}
