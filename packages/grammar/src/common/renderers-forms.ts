// Common form and input renderers. Every control shares the Field contract (label, description,
// error, required/disabled/read-only/invalid) and stamps the same `data-grammar-*` state hooks.
import { Field } from "../core/primitive/Field/index.js"
import { Textarea } from "../core/primitive/Textarea/index.js"
import { SearchField } from "../core/primitive/SearchField/index.js"
import { NumberField } from "../core/primitive/NumberField/index.js"
import { Checkbox } from "../core/primitive/Checkbox/index.js"
import { Switch } from "../core/primitive/Switch/index.js"
import { Slider } from "../core/primitive/Slider/index.js"
import { DateField } from "../core/primitive/DateField/index.js"
import { TimeField } from "../core/primitive/TimeField/index.js"
import { FileDropzone } from "../core/primitive/FileDropzone/index.js"
import { Fieldset } from "../core/composite/Fieldset/index.js"
import { Form } from "../core/composite/Form/index.js"
import { CheckboxGroup } from "../core/composite/CheckboxGroup/index.js"
import { RadioGroup } from "../core/composite/RadioGroup/index.js"
import { SegmentedControl } from "../core/composite/SegmentedControl/index.js"
import { ButtonGroup } from "../core/composite/ButtonGroup/index.js"
import { Select } from "../core/branch/Select/index.js"
import { ComboBox } from "../core/branch/ComboBox/index.js"
import { DatePicker } from "../core/branch/DatePicker/index.js"
import { DateRangePicker } from "../core/branch/DateRangePicker/index.js"

export { Field, type FieldControlAttributes, type FieldControlProps, type FieldProps } from "../core/primitive/Field/index.js"
export { Textarea, type TextareaProps } from "../core/primitive/Textarea/index.js"
export { SearchField, type SearchFieldProps } from "../core/primitive/SearchField/index.js"
export { NumberField, type NumberFieldProps } from "../core/primitive/NumberField/index.js"
export { Checkbox, type CheckboxProps } from "../core/primitive/Checkbox/index.js"
export { Switch, type SwitchProps } from "../core/primitive/Switch/index.js"
export { Slider, type SliderProps, type SliderValue } from "../core/primitive/Slider/index.js"
export { DateField, type DateFieldProps, type DateGranularity } from "../core/primitive/DateField/index.js"
export { TimeField, type TimeFieldProps } from "../core/primitive/TimeField/index.js"
export { FileDropzone, type FileDropzoneProps } from "../core/primitive/FileDropzone/index.js"
export { Fieldset, type FieldsetProps } from "../core/composite/Fieldset/index.js"
export { Form, type FormProps, type FormValidationErrors } from "../core/composite/Form/index.js"
export { CheckboxGroup, type CheckboxGroupProps, type ChoiceOption, type ChoiceOrientation } from "../core/composite/CheckboxGroup/index.js"
export { RadioGroup, type RadioGroupProps } from "../core/composite/RadioGroup/index.js"
export { SegmentedControl, type SegmentOption, type SegmentedControlProps } from "../core/composite/SegmentedControl/index.js"
export { ButtonGroup, type ButtonGroupProps } from "../core/composite/ButtonGroup/index.js"
export { Select, type ListOption, type SelectProps } from "../core/branch/Select/index.js"
export { ComboBox, type ComboBoxProps } from "../core/branch/ComboBox/index.js"
export { DatePicker, type DatePickerProps } from "../core/branch/DatePicker/index.js"
export { DateRangePicker, type DateRangePickerProps, type DateRangeValue } from "../core/branch/DateRangePicker/index.js"

/** The form group of Common renderers, spread into `COMMON_GRAMMAR_COMPONENTS`. */
export const COMMON_FORMS_COMPONENTS = Object.freeze({
    ButtonGroup, Checkbox, CheckboxGroup, ComboBox, DateField, DatePicker, DateRangePicker, Field,
    Fieldset, FileDropzone, Form, NumberField, RadioGroup, SearchField, SegmentedControl, Select,
    Slider, Switch, Textarea, TimeField,
} as const)
