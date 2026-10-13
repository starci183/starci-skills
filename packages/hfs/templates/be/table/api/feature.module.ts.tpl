import { Module } from "@nestjs/common"
import { Create{{Singular}}Handler } from "./application/create-{{singular}}.handler"
import { Get{{Singular}}Handler } from "./application/get-{{singular}}.handler"

@Module({ providers: [Get{{Singular}}Handler, Create{{Singular}}Handler] })
/** The {{name}} feature: the handlers of its application. */
export class {{Name}}ApiModule {}
