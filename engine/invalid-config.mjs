/** The one `Invalid config.yaml:` raiser every section validator shares: bad('<rest>') throws it. */
export const invalid=section=>message=>{throw Error(`Invalid config.yaml: ${section}${message}`);};
