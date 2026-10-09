import type { ReactNode } from 'react';
import { Label, ListBox, Select, type SelectProps } from '@heroui/react';
import { cn } from '@/lib/utils';

type NativeSelectProps = Omit<SelectProps<object>, 'children' | 'id' | 'ref' | 'value' | 'defaultValue' | 'onChange' | 'selectionMode'> & {
  children: ReactNode;
  id?: string;
  label?: ReactNode;
  size?: 'sm' | 'default';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/** Single-value filter composition; callbacks receive the selected collection ID. */
function NativeSelect({ children, className, id, label, size = 'default', value, defaultValue, onValueChange, ...props }: NativeSelectProps) {
  return <Select
    {...props}
    className={cn('min-w-0', className)}
    selectionMode="single"
    value={value}
    defaultValue={defaultValue}
    onChange={selected => { if (selected !== null) onValueChange?.(String(selected)); }}
  >
    {label ? <Label>{label}</Label> : null}
    <Select.Trigger id={id} className={cn('w-full min-w-0', size === 'sm' ? 'h-8 text-xs' : 'h-9')}>
      <Select.Value className="min-w-0 truncate" />
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover className="max-w-[calc(100vw-2rem)]"><ListBox>{children}</ListBox></Select.Popover>
  </Select>;
}

// Direct collection members retain React Aria's item/section identity.
const NativeSelectOption = ListBox.Item;
const NativeSelectOptGroup = ListBox.Section;

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
