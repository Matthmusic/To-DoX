import type { Meta, StoryObj } from '@storybook/react';
import { Settings, Archive, Download, Trash2, Edit, Bell, Palette } from 'lucide-react';
import { DropdownMenu, DropdownItem } from '../components/DropdownMenu';

const meta: Meta = {
  title: 'UI/DropdownMenu',
  parameters: { layout: 'centered' },
};

export default meta;

export const SettingsMenu: StoryObj = {
  name: 'Menu Paramètres',
  render: () => (
    <div className="p-8">
      <DropdownMenu icon={Settings} label="Paramètres">
        <DropdownItem icon={Bell} label="Notifications" onClick={() => {}} />
        <DropdownItem icon={Palette} label="Thèmes" onClick={() => {}} />
        <DropdownItem icon={Archive} label="Archives" onClick={() => {}} />
        <DropdownItem icon={Download} label="Exporter" onClick={() => {}} />
      </DropdownMenu>
    </div>
  ),
};

export const ActionMenu: StoryObj = {
  name: 'Menu Actions tâche',
  render: () => (
    <div className="p-8">
      <DropdownMenu icon={Edit} label="Actions">
        <DropdownItem icon={Edit} label="Modifier" onClick={() => {}} />
        <DropdownItem icon={Archive} label="Archiver" onClick={() => {}} />
        <DropdownItem
          icon={Trash2}
          label="Supprimer"
          onClick={() => {}}
          className="text-red-400 hover:bg-red-500/10"
        />
      </DropdownMenu>
    </div>
  ),
};

export const SingleItem: StoryObj = {
  name: 'Item seul (hors menu)',
  render: () => (
    <div className="p-8 flex gap-4">
      <DropdownItem icon={Edit} label="Modifier" onClick={() => {}} />
      <DropdownItem icon={Archive} label="Archiver" onClick={() => {}} />
      <DropdownItem icon={Trash2} label="Supprimer" onClick={() => {}} className="text-red-400" />
    </div>
  ),
};
