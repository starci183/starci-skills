/** A domain service class that consumers may inject by class. */
export class OrderService {
    open(id: string): string {
        return id
    }
}
