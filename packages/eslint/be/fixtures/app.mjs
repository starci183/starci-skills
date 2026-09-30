/**
 * The app declaration of a fixture: a product is one app repository whose hfs.json declares both sides, so a back-end fixture
 * declares its be side (`fields`: apps, optionalSlots, connections, reads) beside the smallest front end.
 */
const OTHER = { be: { apps: [{ name: "core", kind: "api" }] }, fe: { apps: [{ name: "web", kind: "next" }] } }

/**
 * @param {"be" | "fe"} side - The side the fixture is about.
 * @param {object} fields - Its apps, optionalSlots, connections and reads.
 * @returns {object} The app hfs.json object.
 */
export const appDeclaration = (side, fields) => ({
    hfs: 2,
    kind: "app",
    project: "fixture",
    sides: { ...OTHER, [side]: fields },
})
