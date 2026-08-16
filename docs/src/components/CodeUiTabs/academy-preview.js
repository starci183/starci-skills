"use client";

import React from "react";
import {Card} from "@heroui/react/card";
import {Chip} from "@heroui/react/chip";
import styles from "./academy-preview.module.css";

/** Documentation chrome. It deliberately is not a product Card. */
export function AcademyDemoFrame({label, title, subtitle, note, family, children}) {
  return (
    <section className={styles.frame} aria-label={`Ví dụ: ${title}`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          {family ? <span className={styles.eyebrow}>{family}</span> : null}
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <Chip color="accent" size="sm" variant="soft">{label}</Chip>
      </header>
      <div className={styles.stage}>{children}</div>
      {note ? <footer className={styles.note}>{note}</footer> : null}
    </section>
  );
}

/** A comparison caption, not another product surface. */
export function AcademyScenario({title, badge, children}) {
  return (
    <section className={styles.scenario}>
      <header className={styles.scenarioHeader}>
        <h4>{title}</h4>
        {badge ? <Chip size="sm" variant="soft">{badge}</Chip> : null}
      </header>
      <div className={styles.scenarioBody}>{children}</div>
    </section>
  );
}

/** Preview of StarCi's SurfaceCard anatomy: label outside, one owned card body. */
export function AcademySurfaceCard({title, fact, children, frameless = false, className = ""}) {
  const body = frameless ? children : (
    <Card className={`p-0 ${className}`} data-component="SurfaceCardSurface">
      <Card.Content className="p-0" data-component="SurfaceCardBody">{children}</Card.Content>
    </Card>
  );

  if (!title) return body;
  return (
    <section className="flex min-w-0 flex-col gap-3" data-component="SurfaceCard">
      <div className="flex flex-row flex-wrap items-baseline gap-2">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        {fact ? <span className="text-sm leading-5 font-normal text-muted">{fact}</span> : null}
      </div>
      {body}
    </section>
  );
}

/** Preview of StarCi's joined-list surface: one boundary, row-owned inset and dividers. */
export function AcademySurfaceListCard({title, fact, children, nested = false, hideLabel = false, className = ""}) {
  return (
    <section className="flex min-w-0 flex-col gap-3" data-component="SurfaceListCard">
      {!hideLabel ? (
        <div className="flex flex-row flex-wrap items-baseline justify-between gap-2">
          <h4 className={fact ? "text-sm leading-5 font-semibold text-foreground" : "text-sm font-medium text-foreground"}>{title}</h4>
          {fact ? <span className="text-xs leading-4 font-normal text-muted">{fact}</span> : null}
        </div>
      ) : null}
      <Card
        className={`p-0 ${className}`}
        data-component="SurfaceListCardSurface"
        data-surface-context={nested ? "nested" : "page"}
      >
        <Card.Content className="p-0" data-component="SurfaceListCardBody">{children}</Card.Content>
      </Card>
    </section>
  );
}
