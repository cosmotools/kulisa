// Development terminal switching in Resources (docs/tasks.md, The Resources panel).
import { PlusIcon, XIcon } from 'lucide-react';
import { SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@ui';
import { useTaskActions, useTask } from './state';
import { newTerminalItems, showDevelopmentTerminal, terminalItems } from './terminals';
import { withKeys } from '../lib/common';
import { agentMark } from '../components/AgentMark';
import { AgentState, STATES } from '../components/AgentState';
import { ButtonMenu, RightClickMenu } from '../components/Menus';

export function DevelopmentTerminalList() {
  const act = useTaskActions();
  const { list, front } = useTask((s) => s.developmentTerminals);
  return <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Agents</SidebarGroupLabel>
      <ButtonMenu items={newTerminalItems}><SidebarGroupAction aria-label="New terminal" title={withKeys('New conversation of an agent, or a terminal', 'terminal.new')}>
        <PlusIcon />
      </SidebarGroupAction></ButtonMenu>
      <SidebarGroupContent>
        {!list.length && <p className="p-2 text-sm text-muted-foreground">No terminals open</p>}
        <SidebarMenu aria-label="Agents and terminals">
          {list.map((t) => {
            const Mark = agentMark(t.agent?.cli ?? 'shell');
            const state = t.starting ? 'Starting…' : t.state ? `The agent ${STATES[t.state]}` : t.agent ? 'Agent' : 'Shell';
            const detail = t.agent?.name ?? t.command;
            return <SidebarMenuItem key={t.id} data-terminal={t.id} data-row aria-label={t.name}>
              <RightClickMenu items={() => terminalItems(t)}>
                <SidebarMenuButton size="lg" isActive={front === t.id} aria-current={front === t.id ? 'true' : undefined}
                  aria-label={t.name} title={[t.name, detail, state].filter(Boolean).join('\n')}
                  onClick={() => void showDevelopmentTerminal(t.id)}>
                  <Mark />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5"><span className="truncate">{t.name}</span><AgentState state={t.state} /></span>
                    <span className="truncate text-xs text-muted-foreground">{[state, detail !== t.name ? detail : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                </SidebarMenuButton>
              </RightClickMenu>
              <SidebarMenuAction aria-label={`Close ${t.name}`} title={t.agent ? "Close: the agent stops (asked first); its conversation stays in the task's history" : 'Close: what runs there stops'}
                onClick={() => void act('development-terminal:close', { id: t.id })}><XIcon /></SidebarMenuAction>
            </SidebarMenuItem>;
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>;
}
