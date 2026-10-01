import { CommissionEntity } from "./entities/commission.entity"
import { CreateCommissionsTable1758400000003 } from "./migrations/1758400000003-create-commissions-table"

/** The entities of the commission capability, for the connection that holds them. */
export const commissionEntities = [CommissionEntity]

/** The migrations of the commission capability, in the order they run. */
export const commissionMigrations = [CreateCommissionsTable1758400000003]
