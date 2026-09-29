import {
    DataSource 
} from "typeorm"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    pingDatabase 
} from "./ping.repository"

describe("pingDatabase (identity)",
    () => {
        it("issues select 1 on the data source it is given",
            async () => {
                const dataSource = mock<DataSource>({
                    query: jest.fn().mockResolvedValue([{
                        "?column?": 1 
                    }]) 
                })

                await expect(pingDatabase(dataSource)).resolves.toBeUndefined()
                expect(dataSource.query).toHaveBeenCalledWith("select 1")
            })

        it("lets a dead connection's failure through",
            async () => {
                const dataSource = mock<DataSource>({
                    query: jest.fn().mockRejectedValue(new Error("connection refused")) 
                })

                await expect(pingDatabase(dataSource)).rejects.toThrow("connection refused")
            })
    })
