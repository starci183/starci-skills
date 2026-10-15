Owner: knowledge/hfs/rules.yaml

# Architecture analysis coverage

## Analysed production source

`HFS_ARCH_CONFIG_UNREAD` means the architecture machine loaded the declaration
and TypeScript projects but found no production source to analyse. An empty
program cannot establish that an application's architecture conforms.

In both lite and full, declare the apps containing production source in `hfs.json`
and ensure their TypeScript `include` patterns load those files. A nonempty
analysed program clears this finding; the machine then judges its source against
the remaining architecture rules.
