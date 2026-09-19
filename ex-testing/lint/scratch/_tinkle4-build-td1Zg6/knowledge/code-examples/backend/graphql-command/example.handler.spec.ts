import {
    ExampleCreateItemHandler,
} from "./example.handler"
import {
    ExampleCreateItemCommand,
} from "./example.command"
import {
    ExampleItemNotFoundException,
} from "@modules/platform/exceptions/errors/example/example-item-not-found"
import {
    UserNotFoundException,
} from "@modules/platform/exceptions/errors/users/user"

describe("ExampleCreateItemHandler",
    () => {
        const command = (itemId: string) => new ExampleCreateItemCommand({
            request: {
                itemId,
            },
            user: {
                id: "u1",
            },
        } as never)

        it("rejects missing catalog items",
            async () => {
                const exists = jest.fn().mockResolvedValueOnce(false)
                const handler = new ExampleCreateItemHandler({
                    exists,
                } as never)
                await expect(handler.execute(command("missing"))).rejects.toBeInstanceOf(ExampleItemNotFoundException)
            })

        it("rejects anonymous callers before querying item state",
            async () => {
                const exists = jest.fn()
                const handler = new ExampleCreateItemHandler({
                    exists,
                } as never)
                await expect(handler.execute(new ExampleCreateItemCommand({
                    request: {
                        itemId: "i1",
                    },
                    user: undefined,
                } as never))).rejects.toBeInstanceOf(UserNotFoundException)
                expect(exists).not.toHaveBeenCalled()
            })

        it("returns an existing item or creates a new one",
            async () => {
                const existing = {
                    id: "item-1",
                }
                const create = jest.fn().mockReturnValue({
                    id: "draft",
                })
                const save = jest.fn().mockResolvedValue({
                    id: "item-2",
                })
                const exists = jest
                    .fn()
                    .mockResolvedValueOnce(true)
                    .mockResolvedValueOnce(true)
                const findOne = jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(null)
                const handler = new ExampleCreateItemHandler({
                    exists,
                    findOne,
                    create,
                    save,
                } as never)
                await expect(handler.execute(command("one"))).resolves.toBe(existing)
                await expect(handler.execute(command("two"))).resolves.toEqual({
                    id: "item-2",
                })
                expect(create).toHaveBeenCalled()
                expect(save).toHaveBeenCalledWith({
                    id: "draft",
                })
            })
    })
