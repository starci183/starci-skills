import { Injectable } from "@nestjs/common"

/** A provider (fixture). */
@Injectable()
export class OrderProvider {}

/** Named like a provider but not one: the type of declaration decides, not the name (fixture). */
export class ReportService {}

/** Not a provider although it ends in Guard: no decorator (fixture). */
export class PlainGuard {}
