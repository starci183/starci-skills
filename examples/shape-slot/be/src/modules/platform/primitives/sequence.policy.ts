/** One step of a sequence: it receives the item and its index and answers a promise that settles when the step is done. */
type SequenceStep<Item> = (item: Item, index: number) => Promise<unknown>

/**
 * Runs `step` over `items` one at a time: a step starts only after the one before it settled, so the order the caller relies on
 * (ordered writes, one connection at a time, stop at the first failure) is the order in the code. The first rejection (or throw)
 * rejects the answer and the items after it never start.
 */
export const eachInOrder = <Item>(items: Iterable<Item>, step: SequenceStep<Item>): Promise<void> =>
    [...items].reduce<Promise<void>>(
        (done, item, index) =>
            done.then(async () => {
                await step(item, index)
            }),
        Promise.resolve(),
    )
