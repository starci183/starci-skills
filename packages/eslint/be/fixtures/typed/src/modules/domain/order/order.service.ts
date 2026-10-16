import { Injectable } from "@nestjs/common"

/** A domain service class that consumers may inject by class. */
@Injectable()
export class OrderService {
    open(id: string): string {
        return id
    }
}
