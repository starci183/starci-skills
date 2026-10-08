/**
 * What a sequential step answers: a promise of its result. A step starts only after the one before it settled, so the order the
 * callers rely on (ordered writes, one connection at a time, stop at the first failure) is the order in the code.
 */
type SequenceStep<Item, Result> = (item: Item, index: number) => Promise<Result>

/** What one attempt of a repeated step answers: `undefined` to go on, any other value to stop with it. */
type RepeatStep<Result> = (attempt: number) => Promise<Result | undefined>

/**
 * Runs `step` over `items` one at a time and answers the results in item order. The first rejection (or throw) rejects the
 * answer, and the items after it never start.
 */
export const mapInOrder = <Item, Result>(
    items: Iterable<Item>,
    step: SequenceStep<Item, Result>,
): Promise<Array<Result>> => {
    const results: Array<Result> = []
    return [...items]
        .reduce<Promise<void>>(
            (done, item, index) =>
                done.then(async () => {
                    results.push(await step(item, index))
                }),
            Promise.resolve(),
        )
        .then(() => results)
}

/** Runs `step` over `items` one at a time; the first rejection (or throw) rejects the answer and the items after it never start. */
export const eachInOrder = async <Item>(items: Iterable<Item>, step: SequenceStep<Item, unknown>): Promise<void> => {
    await mapInOrder(items, step)
}

/**
 * Runs `step(attempt)` again, attempts counted from 0, each after the previous one settled, until one answers something other
 * than `undefined`; that answer is the result. The next attempt starts from the settled promise of the previous one, so a
 * loop that runs for the life of the app holds no growing chain. A rejection ends the loop.
 */
export const repeatInOrder = <Result>(step: RepeatStep<Result>): Promise<Result> =>
    new Promise<Result>((resolve, reject) => {
        const attempt = (number: number): void => {
            new Promise<Result | undefined>((settle) => settle(step(number))).then((outcome) => {
                if (outcome === undefined) attempt(number + 1)
                else resolve(outcome)
            }, reject)
        }
        attempt(0)
    })
