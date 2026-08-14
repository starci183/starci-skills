# course-detail-page-v3

## plan

SCOPE
| | |
|---|---|
| Doing | Choose how prerequisites, the pricing ladder, trial/cart and a review block land on the course detail page |
| Repo / branch | D:\Repositories\starci-academy-fe |
| Touching | .artifacts/design-plan/course-detail-page-v3/** |
| Not touching | src/**, the legacy repo, the backend |
| Produces | Three real screens at a URL, and one chosen |

CHOSE   direction A, "the rail decides and it does not move" - answered "A" after the three
        directions were hosted. An earlier bare "ok" was NOT recorded as a selection; the choice was
        put once more as a named question first.

        Everything new lands where the named legacy render already put it: prerequisites under the
        promises, the discount ladder in the rail, trial and cart under the primary enrol button,
        reviews at the foot. The rail holds still, because a buy box that animates while a reader
        compares a price is a buy box they stop trusting.

        It absorbs the older `cart` case, whose direction was chosen and never previewed, rather
        than leaving two cases competing for one rail.

TOOK    Two of the seven requested items were ALREADY built - `course-promise-list` and
        `course-module-list` are joined SurfaceListCard lists today, the second an `ol` because
        modules are ordered. Excluded from the case rather than dressed up as work.

TOOK    "Sticky card with an effect" was never defined, so rather than assume a meaning it became a
        differentiator: each direction answered it differently and choosing A chose "the rail does
        not move".

COST    The reviews sit furthest from the moment of decision - the one thing the backend built this
        session exists to serve. That is the trade the parity posture makes.

OPEN    Does an empty review block at the foot read as "no reviews yet" or as a broken region?
OPEN    Should the trial button disappear or disable once a trial is spent? The backend has
        startTrial but the page has no state evidence for a spent trial.
