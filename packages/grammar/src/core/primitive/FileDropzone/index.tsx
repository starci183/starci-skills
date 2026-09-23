"use client"

import { useId, useState, type ReactNode } from "react"
import { fieldStateAttributes, isFieldInvalid, type FieldControlProps } from "../Field/index.js"

export type FileDropzoneProps = FieldControlProps & {
    readonly id?: string
    /** Native `accept` list, e.g. `image/*,.pdf`. A hint to the picker, not a security check. */
    readonly accept?: string
    readonly multiple?: boolean
    /** The files now in the input. Upload, size checks and previews are the app's. */
    readonly onFilesChange?: (files: Array<File>) => void
    /** Copy inside the drop target. The words are the app's. */
    readonly prompt: ReactNode
    /** Decorative glyph above the prompt. */
    readonly icon?: ReactNode
    /** Hides the list of chosen file names under the target. */
    readonly hideFileList?: boolean
}

/**
 * A native file input stretched over a drop target.
 *
 * The browser owns picking, keyboard activation, the "choose file" announcement and dropping (a
 * file dropped on a file input is a native change), so the files land in the real input and submit
 * with the form. Grammar adds only the drag-over state, the field anatomy, and the chosen names.
 */
export const FileDropzone = ({
    id: idProp,
    accept,
    multiple = false,
    onFilesChange,
    prompt,
    icon,
    hideFileList = false,
    label,
    isLabelHidden,
    description,
    errorMessage,
    isInvalid,
    isRequired,
    isDisabled,
    isReadOnly,
    name,
}: FileDropzoneProps) => {
    const generated = useId().replace(/:/g, "")
    const id = idProp ?? `file${generated}`
    const [isDragging, setIsDragging] = useState(false)
    const [files, setFiles] = useState<Array<File>>([])
    const invalid = isFieldInvalid({ isInvalid, errorMessage })
    const blocked = isDisabled === true || isReadOnly === true
    const descriptionId = description == null ? undefined : `${id}-description`
    const errorId = invalid && errorMessage != null ? `${id}-error` : undefined
    const describedBy = [descriptionId, errorId].filter((part) => part !== undefined).join(" ")

    return (
        <div
            data-tier="atom"
            data-component="FileDropzone"
            className="starci-core-field starci-core-file-dropzone"
            {...fieldStateAttributes({ isInvalid: invalid, isDisabled, isReadOnly, isRequired })}
        >
            <label
                htmlFor={id}
                className={isLabelHidden === true ? "starci-core-field-label starci-core-form-label--screen-reader" : "starci-core-field-label"}
                data-grammar-field-label="true"
                data-required={isRequired === true ? "true" : undefined}
            >
                {label}
                {isRequired === true ? <span aria-hidden="true" className="starci-core-field-required">*</span> : null}
            </label>
            {descriptionId === undefined ? null : (
                <span id={descriptionId} className="starci-core-field-description" data-grammar-field-description="true">{description}</span>
            )}
            <div
                className="starci-core-file-dropzone-target"
                data-grammar-field-control="true"
                data-grammar-drag={isDragging ? "over" : "idle"}
                onDragEnter={() => { if (!blocked) setIsDragging(true) }}
                onDragOver={(event) => { if (blocked) event.preventDefault() }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                    setIsDragging(false)
                    if (blocked) event.preventDefault()
                }}
            >
                <input
                    id={id}
                    type="file"
                    className="starci-core-file-dropzone-input"
                    {...(accept === undefined ? {} : { accept })}
                    {...(name === undefined ? {} : { name })}
                    multiple={multiple}
                    disabled={isDisabled === true}
                    required={isRequired === true}
                    aria-readonly={isReadOnly === true ? true : undefined}
                    {...(invalid ? { "aria-invalid": true } : {})}
                    {...(describedBy === "" ? {} : { "aria-describedby": describedBy })}
                    onClick={(event) => { if (isReadOnly === true) event.preventDefault() }}
                    onChange={(event) => {
                        const next = Array.from(event.currentTarget.files ?? [])
                        setFiles(next)
                        onFilesChange?.(next)
                    }}
                />
                <span className="starci-core-file-dropzone-prompt">
                    {icon == null ? null : <span aria-hidden="true" className="starci-core-file-dropzone-icon">{icon}</span>}
                    <span>{prompt}</span>
                </span>
            </div>
            {hideFileList || files.length === 0 ? null : (
                <ul className="starci-core-file-dropzone-files" data-grammar-file-list="true" aria-live="polite">
                    {files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}
                </ul>
            )}
            {errorId === undefined ? null : (
                <span id={errorId} className="starci-core-field-error" data-grammar-field-error="true">{errorMessage}</span>
            )}
        </div>
    )
}
