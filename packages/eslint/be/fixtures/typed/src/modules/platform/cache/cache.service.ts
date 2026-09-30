/** A platform service class that consumers must not inject by class. */
export class CacheService {
    get(key: string): string | null {
        return key === "" ? null : key
    }
}
