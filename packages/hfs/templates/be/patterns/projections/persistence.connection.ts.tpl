import { {{Name}}ProjectionEntity } from "../{{name}}.projection-entity"
import { Create{{Name}}Projection{{epochMs13}} } from "./migrations/{{epochMs13}}-create-{{name}}"

/** The entities of the {{name}} read model, for the connection that holds them. */
export const {{nameCamel}}Entities = [{{Name}}ProjectionEntity]

/** The migrations of the {{name}} read model, in the order they run. */
export const {{nameCamel}}Migrations = [Create{{Name}}Projection{{epochMs13}}]
