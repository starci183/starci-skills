"use client";

import {Tabs} from "nextra/components";
import {EXAMPLES} from "./examples";
import styles from "./styles.module.css";

export default function CodeUiTabs({example}) {
  const definition = EXAMPLES[example];

  if (!definition) {
    return <div className={styles.unknown} role="alert">Không tìm thấy live example <code>{example}</code>.</div>;
  }

  const Preview = definition.render;

  return (
    <div className={styles.root}>
      <Tabs items={["UI", "Code"]} storageKey={`code-ui-${example}`}>
        <Tabs.Tab><Preview /></Tabs.Tab>
        <Tabs.Tab>
          <div className={styles.codeHeader}>{definition.title}</div>
          <pre className={styles.codeBlock}><code>{definition.code}</code></pre>
        </Tabs.Tab>
      </Tabs>
    </div>
  );
}
