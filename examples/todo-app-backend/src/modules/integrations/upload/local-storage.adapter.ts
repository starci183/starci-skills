import {
    Injectable 
} from "@nestjs/common"
import {
    mkdir, readFile, rm, writeFile 
} from "node:fs/promises"
import {
    join, resolve, sep 
} from "node:path"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    UploadStorageUnavailableException 
} from "@modules/shared/exceptions/errors/upload/upload-storage-unavailable"
import {
    UploadStoragePort 
} from "./upload.contracts"

/**
 * integration.upload.local's storage adapter: objects live under one configured directory
 * (UPLOAD_DIR, defaulting to an os temp dir - see AppConfigService.getUploadStorageDir), keyed by the
 * caller-supplied storage key. That key is always `uploads/<uuid>` minted by UploadService from a
 * random id, never user input; the resolve/startsWith containment check in pathFor still guards it,
 * so even a hypothetical future caller passing `../` lands outside the root and is refused before a
 * byte moves.
 *
 * This is the dev-compose answer to "where do the bytes go" (the api runs on the host, so a directory
 * is the local volume); the same port is where an S3/minio adapter slots in later - minio already
 * stands in the dev compose file for exactly that swap.
 */
@Injectable()
/** Filesystem UploadStoragePort - one directory, one file per storage key. */
export class LocalStorageAdapter extends UploadStoragePort {
    constructor(private readonly config: AppConfigService) {
        super()
    }

    async put(storageKey: string, content: Buffer): Promise<void> {
        const filePath = this.pathFor(storageKey)
        await mkdir(join(filePath,
            ".."),
        {
            recursive: true 
        })
        await writeFile(filePath,
            content)
    }

    async get(storageKey: string): Promise<Buffer | null> {
        try {
            return await readFile(this.pathFor(storageKey))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
            throw error
        }
    }

    async delete(storageKey: string): Promise<void> {
        await rm(this.pathFor(storageKey),
            {
                force: true 
            })
    }

    /** Resolves a storage key to a path inside the root and refuses anything that escapes it. */
    private pathFor(storageKey: string): string {
        const root = resolve(this.config.getUploadStorageDir())
        const filePath = resolve(join(root,
            storageKey))
        if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
            throw new UploadStorageUnavailableException({
                reason: `storage key escapes the upload root: ${storageKey}` 
            })
        }
        return filePath
    }
}
