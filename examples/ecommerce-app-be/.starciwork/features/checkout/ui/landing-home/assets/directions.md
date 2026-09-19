# Ecommerce directions: duck + teal

Five generated desktop directions, each 1536 × 1024. **Direction, not implementation.**
Every selected image carries that label visibly and has an exact sibling prompt.
Generation used the built-in `image_gen.imagegen` tool; no image was hand-drawn,
composited, recoloured, or otherwise modified by a script.

| Representative screen | Selected image | Exact final prompt | UI record |
| --- | --- | --- | --- |
| Landing home · `:3069/` | [Image](./landing-home.png) | [Prompt](./landing-home.prompt.txt) | [Record](../index.yaml) |
| Shop browse · `:4069/browse` | [Image](../../shop-browse/assets/shop-browse.png) | [Prompt](../../shop-browse/assets/shop-browse.prompt.txt) | [Record](../../shop-browse/index.yaml) |
| Populated cart · `:4069/cart` | [Image](../../cart/assets/cart.png) | [Prompt](../../cart/assets/cart.prompt.txt) | [Record](../../cart/index.yaml) |
| Account / sign-in · `:4069/account` | [Image](../../../../identity/ui/sign-in/assets/sign-in.png) | [Prompt](../../../../identity/ui/sign-in/assets/sign-in.prompt.txt) | [Record](../../../../identity/ui/sign-in/index.yaml) |
| Stock refusal · `:4069/checkout` | [Image](../../stock-refused/assets/stock-refused.png) | [Prompt](../../stock-refused/assets/stock-refused.prompt.txt) | [Record](../../stock-refused/index.yaml) |

The bounded draw work is complete. UI records remain `uninvestigate`: these are
agent-reviewed proposals, with no owner acceptance or implemented behavior claimed.
The records enumerate every visible control and distinguish existing routes from
proposed actions. The current frontend still defers cart persistence and sign-in;
the generated populated cart, add-to-cart controls and sign-in form do not change that.

The prompt formula is the requested B3 sequence: frame and subject, **FIXED ANATOMY**
with literal inside/outside containment and anti-pattern callouts, **BRAND + TOKENS**,
then **CREATIVE LICENSE** with explicit **You MAY / You MAY NOT**, and exact text rules.
The [retained B3 source](./B3-source.txt) was found
in `ex-draw-v4/gen-lab/out/B3-final.txt`; the brief's `gen-lab/prompts/B3-final.txt`
location did not exist.

[Brand rev 1](../../../../../brand/index.yaml) is unchanged. The actual Todo grammar renders were
inspected and passed as image inputs; each UI record pins their repository paths,
SHA-256 hashes, the source commit, brand hash/revision and anatomy-source rules.
Product tiles, heroes, auth split and refusal composition are explicitly app-owned.
Each assets folder also contains `generation-receipts.yaml`, including tool output
identities, prompt hashes and image-input hashes. `.initial` and `.anatomy` images
are retained, non-selected edit inputs, each with its own exact sibling prompt.

Visual review confirmed the collection labels/counts above and captions below their
list shells, internal summary/refusal card labels, and grey nested inputs. A targeted
edit removed inherited Todo account navigation from the cart; another extended the
stock-refusal divider to both outer shell edges. The auth illustration stays left,
with the frameless form right. Ducks appear only in the landing welcome and auth
illustration. The entire stock-refusal frame contains no mascot.

The exact primary token is **`#0D9488`**. Black button ink calculates to **5.6086:1**
against that token; white would be only **3.7443:1**, below the brand's 4.5:1 minimum.
Generated raster fills still vary despite a focused colour correction. These sampled
button pixels document that limit; they are **not replacement brand tokens**:

| Image | Sample coordinate (x, y) | Observed raster pixel |
| --- | --- | --- |
| Landing | 120, 300 | `#019993` |
| Browse | 250, 550 | `#069990` |
| Cart | 1080, 517 | `#09989C` |
| Sign-in | 960, 655 | `#149E92` |
| Stock refusal | 205, 897 | `#00A19F` |

Implementation must take colour from the brand record and control scale/radius from
the installed grammar, rather than sample these PNGs. Typography is enlarged in some
directions, as described by the anatomy source's `direction-scale-drift` observation.
Product illustration finish and duck pose also vary. These images establish layout,
containment and state composition; they are not final artwork, accessibility evidence,
mobile designs, live inventory, or browser captures.

[Artifact verification](./direction-check.yaml)
records PNG integrity, hashes, prompt/reference pairing, coverage and link checks.
No frontend, Todo example, brand record, ops, checks, scripts or CI files were changed.
