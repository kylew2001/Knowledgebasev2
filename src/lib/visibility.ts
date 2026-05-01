export type VisibilityMode = "everyone" | "groups";

export type VisibilityRule = {
  mode: VisibilityMode;
  groupIds: string[];
};

export const everyoneVisibility: VisibilityRule = {
  mode: "everyone",
  groupIds: []
};

export type VisibilityGroup = {
  id: string;
  parent_id: string | null;
  name: string;
};

export function getGroupPath(group: VisibilityGroup, groups: VisibilityGroup[]) {
  const path = [group.name];
  let parentId = group.parent_id;

  while (parentId) {
    const parent = groups.find((item) => item.id === parentId);
    if (!parent) break;
    path.unshift(parent.name);
    parentId = parent.parent_id;
  }

  return path.join(" > ");
}

function getGroupAncestorIds(groupId: string, groups: VisibilityGroup[]) {
  const ids = new Set([groupId]);
  let parentId = groups.find((group) => group.id === groupId)?.parent_id ?? null;

  while (parentId) {
    ids.add(parentId);
    parentId = groups.find((group) => group.id === parentId)?.parent_id ?? null;
  }

  return ids;
}

export function canSeeVisibility(
  visibility: VisibilityRule | undefined,
  userGroupIds: string[],
  groups: VisibilityGroup[],
  canSeeAll = false
) {
  if (canSeeAll) return true;
  const rule = visibility ?? everyoneVisibility;
  if (rule.mode === "everyone") return true;
  if (rule.groupIds.length === 0) return false;

  return userGroupIds.some((userGroupId) => {
    const allowedGroupIds = getGroupAncestorIds(userGroupId, groups);
    return rule.groupIds.some((groupId) => allowedGroupIds.has(groupId));
  });
}

export function getVisibilityLabel(visibility: VisibilityRule | undefined, groups: VisibilityGroup[]) {
  const rule = visibility ?? everyoneVisibility;
  if (rule.mode === "everyone") return "Everyone";
  if (rule.groupIds.length === 0) return "No groups selected";

  return rule.groupIds
    .map((groupId) => groups.find((group) => group.id === groupId))
    .filter((group): group is VisibilityGroup => Boolean(group))
    .map((group) => getGroupPath(group, groups))
    .join(", ");
}
