import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Layout composition only. Navigation controls are HeroUI Links in the app shell.
function SidebarShell({ className, ...props }: ComponentProps<'div'>) {
  return <div data-ui="sidebar-wrapper" className={cn('min-h-svh w-full', className)} {...props} />;
}

function Sidebar({ className, ...props }: ComponentProps<'aside'>) {
  return <aside data-ui="sidebar" className={cn('flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground', className)} {...props} />;
}

function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-ui="sidebar-header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-ui="sidebar-content" className={cn('no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto', className)} {...props} />;
}

function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-ui="sidebar-footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
}

function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-ui="sidebar-menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return <li data-ui="sidebar-menu-item" className={className} {...props} />;
}

export { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarShell };
