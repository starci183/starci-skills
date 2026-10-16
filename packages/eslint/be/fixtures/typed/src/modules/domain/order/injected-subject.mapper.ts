import { Inject, Injectable } from "@nestjs/common"

@Injectable()
export class Gate {
    constructor(readonly limit: number) {}
}

export class Tokened {
    constructor(@Inject("LIMIT") readonly limit: number) {}
}
