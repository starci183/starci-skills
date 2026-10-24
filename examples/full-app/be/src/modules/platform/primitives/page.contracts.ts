/** One page of a cursor-paginated list: the items, where the next page starts and whether there is one. */
export interface Page<Item> {
    /** The items of this page, in list order. */
    readonly items: ReadonlyArray<Item>
    /** The opaque, signed cursor of the last item of this page; null for an empty page. */
    readonly endCursor: string | null
    /** True when at least one more item follows this page. */
    readonly hasNextPage: boolean
}

/** The keyset position a page ends at: the sort value of the last item and its id, which breaks ties. */
export interface PageCursor {
    /** The sort value of the item, as text so the database round trip loses nothing. */
    readonly sortValue: string
    /** The id of the item. */
    readonly id: string
}

/** What reading a cursor answers: the position it names, or null when it is malformed or was not signed with the key. */
export type CursorReading = PageCursor | null

/** How `pageOf` turns the rows one read fetched into a page. */
export interface PageRequest<Row, Item> {
    /** The page size the client asked for; the read fetched one row more to learn whether a next page exists. */
    readonly first: number
    /** The key the cursors are signed with. */
    readonly key: string
    /** The keyset position of a row. */
    readonly positionOf: (row: Row) => PageCursor
    /** The item a row becomes. */
    readonly itemOf: (row: Row) => Item
}
