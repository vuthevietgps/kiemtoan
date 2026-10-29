import { ServiceTeamRole } from '@prisma/client';

/** Nhóm thực hiện dòng dịch vụ kế toán (đặc tả 05, H8/G1): Manager, trưởng nhóm, trợ lý. */

export const MAX_TEAM_ASSISTANTS = 10;

export interface ServiceTeamInput {
  managerId: string | null;
  leadId: string | null;
  assistantIds: string[];
}

export function emptyServiceTeam(): ServiceTeamInput {
  return { managerId: null, leadId: null, assistantIds: [] };
}

/** Không ai giữ hai vai trong cùng nhóm (như 04-F). */
export function serviceTeamError(team: ServiceTeamInput): string | null {
  if (team.assistantIds.length > MAX_TEAM_ASSISTANTS)
    return `Tối đa ${MAX_TEAM_ASSISTANTS} trợ lý`;
  const members = [team.managerId, team.leadId, ...team.assistantIds].filter(
    (id): id is string => !!id,
  );
  if (new Set(members).size !== members.length)
    return 'Một người không giữ hai vai trong cùng nhóm thực hiện';
  return null;
}

export interface TeamRoleAssignment {
  role: ServiceTeamRole;
  userId: string;
}

export function serviceTeamRoles(team: ServiceTeamInput): TeamRoleAssignment[] {
  const single: [ServiceTeamRole, string | null][] = [
    [ServiceTeamRole.MANAGER, team.managerId],
    [ServiceTeamRole.LEAD, team.leadId],
  ];
  return [
    ...single
      .filter((entry): entry is [ServiceTeamRole, string] => !!entry[1])
      .map(([role, userId]) => ({ role, userId })),
    ...team.assistantIds.map((userId) => ({
      role: ServiceTeamRole.ASSISTANT,
      userId,
    })),
  ];
}

/** Vai bị bỏ (đóng lịch sử) và vai mới (mở lịch sử) giữa hai đội hình. */
export function diffTeamRoles(
  before: TeamRoleAssignment[],
  after: TeamRoleAssignment[],
) {
  const key = (a: TeamRoleAssignment) => `${a.role}:${a.userId}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  return {
    closed: before.filter((a) => !afterKeys.has(key(a))),
    opened: after.filter((a) => !beforeKeys.has(key(a))),
  };
}
