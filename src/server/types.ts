import type { AchievementCode } from "@/domain/achievements/achievements";
import type {
  MotivationEvent,
  MotivationTone,
} from "@/domain/motivation/types";
import type { EffortLevel, PointBreakdown } from "@/domain/rewards/types";
import type {
  MembershipRole,
  TaskPermissions,
} from "@/domain/tasks/task-permissions";

export type { MembershipRole } from "@/domain/tasks/task-permissions";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: MembershipRole;
}

export interface WorkspaceNavigationView {
  workspaces: Array<
    WorkspaceSummary & {
      projects: Array<{ id: string; name: string }>;
    }
  >;
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
}

export interface WorkspaceOverview {
  id: string;
  name: string;
  actorRole: MembershipRole;
  projects: Array<
    ProjectSummary & {
      doneTasks: number;
      totalTasks: number;
      percentComplete: number;
    }
  >;
}

export interface TaskView {
  id: string;
  createdBy: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assigneeName: string;
  status: TaskStatus;
  effort: EffortLevel;
  dueAt: string | null;
  estimatedBasePoints: number;
  permissions: TaskPermissions;
  isCurrentUsersTask: boolean;
  isFocusTask: boolean;
}

export interface ProjectBoardView {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  description: string | null;
  workDate: string;
  celebrationAnimationEnabled: boolean;
  actorRole: MembershipRole;
  members: Array<{
    id: string;
    displayName: string;
  }>;
  tasks: TaskView[];
}

export interface AchievementView {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  grantedAt: string;
}

export interface CompletionReceipt {
  completionId: string;
  taskId: string;
  projectId: string;
  workspaceId: string;
  taskTitle: string;
  wasNewCompletion: boolean;
  points: PointBreakdown;
  preCompletionStreak: number;
  postCompletionStreak: number;
  streakIncremented: boolean;
  achievements: AchievementView[];
  achievementVisibilityEnabled: boolean;
  celebrationAnimationEnabled: boolean;
  message: {
    event: MotivationEvent;
    tone: MotivationTone;
    key: string;
    title: string;
    body: string;
  };
  projectProgress: {
    doneTasks: number;
    totalTasks: number;
    percentComplete: number;
  };
}

export interface TaskMutationReceipt {
  taskId: string;
  projectId: string;
  workspaceId: string;
  status: TaskStatus;
  completion: CompletionReceipt | null;
}

export interface FocusSelectionView {
  id: string;
  taskId: string;
  workDate: string;
}

export type CompletionCelebrationView = CompletionReceipt;

export interface DashboardPointActivity {
  completionId: string;
  taskTitle: string;
  completedAt: string;
  basePoints: number;
  timingBonus: number;
  streakBonus: number;
  finalPoints: number;
}

export interface DashboardAchievementState {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  grantedAt: string | null;
}

export interface DashboardView {
  hasWorkspace: boolean;
  user: {
    displayName: string;
    timezone: string;
  };
  focusTask: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
  } | null;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  pointActivity: DashboardPointActivity[];
  achievements: DashboardAchievementState[];
  achievementsVisible: boolean;
  unreadNotificationCount: number;
  projects: Array<{
    id: string;
    workspaceId: string;
    name: string;
    doneTasks: number;
    totalTasks: number;
    percentComplete: number;
  }>;
  notification: {
    title: string;
    body: string;
  } | null;
}
