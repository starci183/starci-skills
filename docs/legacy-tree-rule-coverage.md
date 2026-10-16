Owner: knowledge/hfs/rules.yaml
# Repository tree and stack evidence

## R02

HFS_SLOT_REQUIRED_MISSING and HFS_MIN_INSTANCES report absent required slot files or too few instances. HFS_REQUIRED_FILE_MISSING reports missing architecture requirements. HFS_ROOT_ENTRY_MISSING, HFS_APPS_REQUIRED and HFS_APP_LAYOUT_INVALID report missing root entries, an absent application collection or an incomplete application. Restore the files required by the declared slots and app kinds.

The README must begin with the repository title and a concise description (HFS_README_TITLE_INVALID, HFS_README_DESCRIPTION_INVALID), include the standard sections in order (HFS_README_SECTION_MISSING, HFS_README_SECTION_ORDER), show the managed development commands (HFS_README_DEVELOPMENT_INCOMPLETE), and point to the existing Work tree (HFS_README_WORK_POINTER_MISSING). Remove private service URLs (HFS_README_PRIVATE_URL) and replace static or insecure badges with live public HTTPS badges (HFS_README_BADGE_NOT_LIVE). The proofs mutate each requirement and verify its correction in both editions.

## R03

HFS_UNTRACKED_ROOT_ENTRY reports an untracked root entry outside an ignored slot. HFS_EMPTY_DIR reports a directory with no files, and HFS_GHOST_TREE reports a tree whose descendants are all ignored outside an ignored slot. Track the intended files, remove the empty tree, or place generated content in its declared ignored slot. Both application editions and their shared runtime checker have violating and corrected filesystem proofs.

## R10

HFS_STACKS_SHAPE reports an invalid `.starcistacks` declaration or runtime deployment shape. Keep the edition's declared backing services and provide pinned images, healthchecks, rollout, rollback and restart policies in the deployment model. The shape proof checks declarations; the runtime proof changes a pinned image to a floating tag and verifies the finding through the runtime and stack gates in both editions.
