"use client";

import type { Channel } from "@roster/api";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@roster/ui";
import { Globe, Link2, Lock, Settings, Star, StarOff } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

export interface MenuSurface {
  Content: ComponentType<any>;
  Item: ComponentType<any>;
  Label: ComponentType<any>;
  RadioGroup: ComponentType<any>;
  RadioItem: ComponentType<any>;
  Separator: ComponentType<any>;
  Sub: ComponentType<any>;
  SubContent: ComponentType<any>;
  SubTrigger: ComponentType<any>;
}

export const CONTEXT_MENU_SURFACE: MenuSurface = {
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubContent: ContextMenuSubContent,
  SubTrigger: ContextMenuSubTrigger,
};

export const DROPDOWN_MENU_SURFACE: MenuSurface = {
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
};

export interface ChannelMenuProps {
  surface: MenuSurface;
  channel: Channel;
  href: string;
  canManage: boolean;
  onToggleStar: (channel: Channel) => void;
  onChangeVisibility: (channel: Channel, visibility: string) => void;
}

function copyLink(href: string) {
  const url =
    typeof window === "undefined" ? href : new URL(href, window.location.origin).toString();
  void navigator.clipboard?.writeText(url);
}

export function ChannelMenu({
  surface: Menu,
  channel,
  href,
  canManage,
  onToggleStar,
  onChangeVisibility,
}: ChannelMenuProps) {
  return (
    <Menu.Content align="start" className="min-w-52">
      <Menu.Item className="gap-2" onSelect={() => onToggleStar(channel)}>
        {channel.starred ? (
          <StarOff className="size-3.5" />
        ) : (
          <Star className="size-3.5" />
        )}
        {channel.starred ? "Remove from starred" : "Add to starred"}
      </Menu.Item>

      <Menu.Item className="gap-2" onSelect={() => copyLink(href)}>
        <Link2 className="size-3.5" />
        Copy link
      </Menu.Item>

      {canManage ? (
        <>
          <Menu.Separator />

          <Menu.Sub>
            <Menu.SubTrigger className="gap-2">
              {channel.visibility === "private" ? (
                <Lock className="size-3.5" />
              ) : (
                <Globe className="size-3.5" />
              )}
              Visibility
            </Menu.SubTrigger>
            <Menu.SubContent className="min-w-40">
              <Menu.RadioGroup
                value={channel.visibility === "private" ? "private" : "public"}
                onValueChange={(value: string) =>
                  onChangeVisibility(channel, value)
                }
              >
                <Menu.RadioItem value="public">Public</Menu.RadioItem>
                <Menu.RadioItem value="private">Private</Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.SubContent>
          </Menu.Sub>

          <Menu.Separator />

          <Menu.Item asChild className="gap-2">
            <Link href={`${href}/settings`}>
              <Settings className="size-3.5" />
              Channel settings
            </Link>
          </Menu.Item>
        </>
      ) : null}
    </Menu.Content>
  );
}
