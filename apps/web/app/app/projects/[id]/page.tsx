'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useToast } from '../../../../lib/use-toast';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';

type Member = { id: string; name: string; email: string; role: string };
type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate?: string | null;
  manager?: Member;
  client: { companyName: string };
  members: Array<{ id: string; userId: string; user: Member }>;
};
type Task = { id: string; title: string; description?: string | null; status: string; priority: string; dueDate?: string | null; assigneeId?: string | null; createdBy: string; assignee?: Member | null; isOverdue?: boolean; isDueSoon?: boolean };
type Assignee = Member;
type TaskForm = { title: string; description: string; status: string; priority: string; assigneeId: string; dueDate: string };
type Milestone = { id: string; title: string; status: string; dueDate?: string | null; requiresClientApproval: boolean; approvalStatus: string };
type AiActionItem = { title: string; assigneeHint: string | null; dueDate: string | null };
type AiSummary = { summary: string; decisions: string[]; actionItems: AiActionItem[] };
type Meeting = { id: string; title: string; meetingDate: string; notes?: string | null; visibleToClient: boolean; aiSummary?: AiSummary | null };
type FeedbackComment = { id: string; body: string; createdAt: string; author: { name: string; role: string } };
type FeedbackItem = { id: string; title: string; description: string; status: string; createdAt: string; submitter: { name: string }; comments: FeedbackComment[] };
type ProjectFile = { id: string; uploadedBy: string; originalName: string; mimeType: string; sizeBytes: number; visibleToClient: boolean; createdAt: string; uploader: { name: string } };
type Tab = 'Tasks' | 'Milestones' | 'Meetings' | 'Members' | 'Feedback' | 'Files';

const tabs: Tab[] = ['Tasks', 'Milestones', 'Meetings', 'Members', 'Feedback', 'Files'];
const feedbackStatuses = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'DECLINED'];
const taskPriorityStyles: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-900',
  LOW: 'bg-muted text-foreground',
  URGENT: 'bg-red-100 text-red-800',
};
const feedbackStatusStyles: Record<string, string> = {
  OPEN: 'border-rose-500/40 text-rose-200',
  IN_REVIEW: 'border-amber-500/40 text-amber-200',
  IN_PROGRESS: 'border-cyan-500/40 text-cyan-200',
  RESOLVED: 'border-emerald-500/40 text-emerald-200',
  DECLINED: 'border-border text-muted-foreground',
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, support } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});
  const [aiItems, setAiItems] = useState<Record<string, AiActionItem[]>>({});
  const [aiSelected, setAiSelected] = useState<Record<string, boolean[]>>({});
  const [aiPanelMeeting, setAiPanelMeeting] = useState<string | null>(null);
  const [aiBusyMeeting, setAiBusyMeeting] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('Tasks');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('');
  const [taskMineOnly, setTaskMineOnly] = useState(false);
  const [taskSort, setTaskSort] = useState<'priority' | 'dueDate'>('priority');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneRequiresApproval, setMilestoneRequiresApproval] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
  const [meetingForm, setMeetingForm] = useState({ title: '', meetingDate: '', visibleToClient: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);
  const isAdmin = user?.role === 'AGENCY_ADMIN';
  const isMember = user?.role === 'AGENCY_MEMBER';

  const load = useCallback(async () => {
    try {
      const taskQuery = new URLSearchParams({ limit: '100', sort: taskSort });
      if (taskPriorityFilter) taskQuery.set('priority', taskPriorityFilter);
      if (taskAssigneeFilter) taskQuery.set('assignee', taskAssigneeFilter);
      if (taskMineOnly) taskQuery.set('mine', 'true');
      const [projectResponse, taskResponse, assigneeResponse, milestoneResponse, meetingResponse, feedbackResponse, filesResponse] = await Promise.all([
        api.get<{ data: Project }>(`/api/v1/projects/${projectId}`),
        api.get<{ data: Task[] }>(`/api/v1/projects/${projectId}/tasks?${taskQuery.toString()}`),
        api.get<{ data: Assignee[] }>(`/api/v1/projects/${projectId}/assignees`),
        api.get<{ data: Milestone[] }>(`/api/v1/projects/${projectId}/milestones`),
        api.get<{ data: Meeting[] }>(`/api/v1/projects/${projectId}/meetings`),
        api.get<{ data: FeedbackItem[] }>(`/api/v1/projects/${projectId}/feedback`),
        api.get<{ data: ProjectFile[] }>(`/api/v1/projects/${projectId}/files`),
      ]);
      const feedbackWithComments = await Promise.all(feedbackResponse.data.map(async (item) => {
        const comments = await api.get<{ data: FeedbackComment[] }>(`/api/v1/feedback/${item.id}/comments`);
        return { ...item, comments: comments.data };
      }));
      setProject(projectResponse.data);
      setTasks(taskResponse.data);
      setAssignees(assigneeResponse.data);
      setMilestones(milestoneResponse.data);
      setMeetings(meetingResponse.data);
      setAiSummaries((current) => {
        const saved: Record<string, AiSummary> = {};
        for (const meeting of meetingResponse.data) {
          if (meeting.aiSummary) saved[meeting.id] = meeting.aiSummary;
        }
        return { ...saved, ...current };
      });
      setFeedback(feedbackWithComments);
      setFiles(filesResponse.data);
      setSelectedMembers(projectResponse.data.members.map((member) => member.userId));
      if (user?.role === 'AGENCY_ADMIN') {
        const teamResponse = await api.get<{ data: Member[] }>('/api/v1/team');
        setTeam(teamResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.role, taskSort, taskPriorityFilter, taskAssigneeFilter, taskMineOnly]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent, action: () => Promise<unknown>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  }

  function openTaskEdit(task: Task) {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId ?? '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    });
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/projects/${projectId}/tasks`, {
        title: taskTitle,
        priority: taskPriority,
        assigneeId: taskAssigneeId || null,
      });
      setTaskTitle('');
      setTaskPriority('MEDIUM');
      setTaskAssigneeId('');
      window.dispatchEvent(new Event('agencyhub:tasks-updated'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create task.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!editingTask) return;
    setBusy(true);
    try {
      await api.patch(`/api/v1/tasks/${editingTask.id}`, {
        ...taskForm,
        description: taskForm.description || null,
        assigneeId: taskForm.assigneeId || null,
        dueDate: taskForm.dueDate || null,
        ...(editingTask.priority === 'URGENT' && taskForm.priority === 'URGENT' ? { priority: undefined } : {}),
      });
      setEditingTask(null);
      toast({ title: 'Task updated', description: `${taskForm.title} was updated.`, variant: 'success' });
      window.dispatchEvent(new Event('agencyhub:tasks-updated'));
      await load();
    } catch (err) {
      toast({ title: 'Could not update task', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask() {
    if (!deleteTaskTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/v1/tasks/${deleteTaskTarget.id}`);
      const title = deleteTaskTarget.title;
      setDeleteTaskTarget(null);
      toast({ title: 'Task deleted', description: `${title} was deleted.`, variant: 'success' });
      window.dispatchEvent(new Event('agencyhub:tasks-updated'));
      await load();
    } catch (err) {
      toast({ title: 'Could not delete task', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleMeeting(meeting: Meeting) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/meetings/${meeting.id}`, { visibleToClient: !meeting.visibleToClient });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update meeting visibility.');
    } finally {
      setBusy(false);
    }
  }

  async function generateMeetingSummary(meeting: Meeting) {
    setAiBusyMeeting(meeting.id);
    setAiPanelMeeting(meeting.id);
    setAiError('');
    setAiSuccess('');
    try {
      const response = await api.post<{ data: AiSummary }>(`/api/v1/meetings/${meeting.id}/ai-summary`);
      const summary = response.data;
      setAiSummaries((current) => ({ ...current, [meeting.id]: summary }));
      setAiItems((current) => ({ ...current, [meeting.id]: summary.actionItems.map((item) => ({ ...item })) }));
      setAiSelected((current) => ({ ...current, [meeting.id]: summary.actionItems.map(() => true) }));
      setMeetings((current) => current.map((item) => item.id === meeting.id ? { ...item, aiSummary: summary } : item));
      setAiPanelMeeting(meeting.id);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not create an AI summary. Please try again.');
    } finally {
      setAiBusyMeeting(null);
    }
  }

  async function createSummaryTasks(meetingId: string) {
    const items = (aiItems[meetingId] ?? []).filter((_item, index) => aiSelected[meetingId]?.[index]);
    if (!items.length) {
      setAiError('Select at least one action item to create a task.');
      return;
    }
    setAiBusyMeeting(meetingId);
    setAiError('');
    setAiSuccess('');
    try {
      const response = await api.post<{ data: Task[] }>(`/api/v1/meetings/${meetingId}/ai-summary/create-tasks`, { items });
      setAiSuccess(`${response.data.length} task${response.data.length === 1 ? '' : 's'} created.`);
      await load();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not create tasks. Please try again.');
    } finally {
      setAiBusyMeeting(null);
    }
  }

  function updateAiItem(meetingId: string, index: number, field: keyof AiActionItem, value: string) {
    setAiItems((current) => ({
      ...current,
      [meetingId]: (current[meetingId] ?? []).map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: value || null }
        : item),
    }));
  }

  async function updateFeedbackStatus(feedbackId: string, status: string) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/feedback/${feedbackId}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update feedback status.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedbackComment(event: FormEvent, feedbackId: string) {
    event.preventDefault();
    const body = commentDrafts[feedbackId]?.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/feedback/${feedbackId}/comments`, { body });
      setCommentDrafts((current) => ({ ...current, [feedbackId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post reply.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadProjectFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    setBusy(true);
    setError('');
    try {
      await api.upload(`/api/v1/projects/${projectId}/files`, formData);
      setSelectedFile(null);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFileVisibility(file: ProjectFile) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/files/${file.id}`, { visibleToClient: !file.visibleToClient });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update file visibility.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProjectFile(fileId: string) {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/api/v1/files/${fileId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete file.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-10 text-sm text-muted-foreground">Loading project…</p>;
  if (!project) return <div role="alert" className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || 'Project not found.'}</div>;

  const completedTaskCount = tasks.filter((task) => task.status === 'DONE').length;
  const projectStatus = project.status.replace('_', ' ').toLowerCase();
  const canEditTasks = isAdmin || isMember;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium text-muted-foreground"><Link href="/app/projects" className="hover:text-indigo-700">Projects</Link> / {project.client.companyName}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">{project.name}</h1>
          <span className={`status-pill ${project.status === 'ACTIVE' || project.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'}`}>{projectStatus}</span>
        </div>
        {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
      </header>

      <section className="surface-card flex flex-wrap items-center gap-4 p-4 sm:gap-5">
        <span className="text-sm text-muted-foreground">Progress</span>
        <div className="progress-track min-w-28 flex-1 bg-indigo-50"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${project.progress}%` }} /></div>
        <strong className="text-base text-foreground">{project.progress}%</strong>
        <span className="w-full text-xs text-muted-foreground sm:w-auto">{completedTaskCount} of {tasks.length} tasks done{project.dueDate ? ` · Due ${new Date(project.dueDate).toLocaleDateString()}` : ''}</span>
      </section>

      {readOnly && <p className="inline-block border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800">Support mode · changes disabled</p>}

      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-800">{error}</p>}
      <div role="tablist" aria-label="Project sections" className="flex overflow-x-auto border-b border-border">
        {tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${tab === item ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item}</button>)}
      </div>

      {tab === 'Tasks' && <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
          <label className="space-y-1 text-xs text-muted-foreground">Sort by<select disabled={readOnly} value={taskSort} onChange={(event) => setTaskSort(event.target.value as 'priority' | 'dueDate')} className="h-9 min-w-36 border border-input bg-white px-2 text-sm text-foreground"><option value="priority">Priority</option><option value="dueDate">Due date</option></select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Priority<select disabled={readOnly} value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value)} className="h-9 min-w-32 border border-input bg-white px-2 text-sm text-foreground"><option value="">All priorities</option>{['HIGH', 'MEDIUM', 'LOW'].map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}</select></label>
          <label className="space-y-1 text-xs text-muted-foreground">Assignee<select disabled={readOnly} value={taskAssigneeFilter} onChange={(event) => setTaskAssigneeFilter(event.target.value)} className="h-9 min-w-40 border border-input bg-white px-2 text-sm text-foreground"><option value="">All assignees</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label className="flex h-9 items-center gap-2 px-1 text-sm text-muted-foreground"><input type="checkbox" disabled={readOnly} checked={taskMineOnly} onChange={(event) => setTaskMineOnly(event.target.checked)} />Mine</label>
        </div>
        {!readOnly && canEditTasks && <form onSubmit={(event) => void createTask(event)} className="grid gap-2 border-b border-border pb-4 sm:grid-cols-[minmax(12rem,1fr)_9rem_minmax(10rem,14rem)_auto]">
          <Input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} aria-label="New task title" placeholder="Add a task" />
          <label className="sr-only" htmlFor="new-task-priority">Priority</label><select id="new-task-priority" disabled={busy || readOnly} value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} aria-label="New task priority" className="h-10 border border-input bg-white px-2 text-sm text-foreground">{['LOW', 'MEDIUM', 'HIGH'].map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}</select>
          <label className="sr-only" htmlFor="new-task-assignee">Assignee</label><select id="new-task-assignee" disabled={busy || readOnly} value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)} aria-label="New task assignee" className="h-10 border border-input bg-white px-2 text-sm text-foreground"><option value="">Unassigned</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
          <Button disabled={busy}>Add task</Button>
        </form>}
        {tasks.length === 0 ? <p className="surface-card p-7 text-center text-sm text-muted-foreground">No tasks in this project.</p> : <div className="surface-card divide-y divide-border px-5">{tasks.map((task) => {
          const taskStatus = task.isOverdue ? 'Overdue' : task.status === 'DONE' ? 'Done' : task.status === 'IN_PROGRESS' ? 'In progress' : task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short' })}` : task.status.replace('_', ' ').toLowerCase();
          const pillStyle = task.isOverdue ? 'bg-red-100 text-red-800' : task.status === 'DONE' ? 'bg-green-100 text-green-800' : task.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' : task.isDueSoon || task.dueDate ? 'bg-amber-100 text-amber-800' : 'bg-muted text-foreground';
          const canDelete = isAdmin || (isMember && (task.createdBy === user?.id || task.assigneeId === user?.id));
          return <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="text-sm font-semibold text-white">{task.title}</p>{task.description && <p className="mt-1 max-w-2xl whitespace-pre-wrap text-xs text-muted-foreground">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><span className={`status-pill ${taskPriorityStyles[task.priority] ?? 'bg-muted text-foreground'}`}>{task.priority === 'URGENT' ? 'Urgent (legacy)' : task.priority[0] + task.priority.slice(1).toLowerCase()}</span>{task.assignee ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-semibold text-cyan-900">{task.assignee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>{task.assignee.name}</span> : <span className="text-xs text-muted-foreground">Unassigned</span>}</div></div><div className="flex items-center gap-2"><span className={`status-pill shrink-0 ${pillStyle}`}>{taskStatus}</span><Button type="button" variant="ghost" size="icon" title="Edit task" aria-label={`Edit ${task.title}`} disabled={readOnly || busy || !canEditTasks} onClick={() => openTaskEdit(task)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" title={canDelete ? 'Delete task' : 'Only the creator or assignee can delete this task'} aria-label={`Delete ${task.title}`} disabled={readOnly || busy || !canDelete} onClick={() => setDeleteTaskTarget(task)}><Trash2 className="h-4 w-4" /></Button></div></div>;
        })}</div>}
      </section>}

      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => { if (!open) setEditingTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>Update task details and assignment.</DialogDescription></DialogHeader>
          <form id="edit-task-form" onSubmit={(event) => void saveTask(event)} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">Title<Input required disabled={readOnly || !canEditTasks} maxLength={255} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></label>
            <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">Description<textarea disabled={readOnly || !canEditTasks} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground disabled:opacity-50" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Status<select disabled={readOnly || !canEditTasks} value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground disabled:opacity-50">{['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Priority<select disabled={readOnly || !canEditTasks} value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground disabled:opacity-50">{taskForm.priority === 'URGENT' && <option value="URGENT">Urgent (legacy)</option>}{['LOW', 'MEDIUM', 'HIGH'].map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Assignee<select disabled={readOnly || !canEditTasks} value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground disabled:opacity-50"><option value="">Unassigned</option>{assignees.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Due date<Input disabled={readOnly || !canEditTasks} type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label>
          </form>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button><Button type="submit" form="edit-task-form" disabled={busy || readOnly || !canEditTasks}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTaskTarget)} onOpenChange={(open) => { if (!open) setDeleteTaskTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete task?</DialogTitle><DialogDescription>{deleteTaskTarget?.title} will be permanently deleted.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDeleteTaskTarget(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void deleteTask()}>Delete task</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {tab === 'Milestones' && <section className="space-y-4">
        {!readOnly && <form onSubmit={(event) => submit(event, () => api.post(`/api/v1/projects/${projectId}/milestones`, { title: milestoneTitle, requiresClientApproval: milestoneRequiresApproval }))} className="flex flex-wrap items-center gap-3"><input required value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} aria-label="New milestone title" placeholder="Add a milestone" className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" /><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" disabled={readOnly || busy} checked={milestoneRequiresApproval} onChange={(event) => setMilestoneRequiresApproval(event.target.checked)} />Requires client approval</label><button disabled={busy} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add milestone</button></form>}
        {milestones.length === 0 ? <p className="border border-dashed border-input p-7 text-center text-sm text-muted-foreground">No milestones yet.</p> : <div className="divide-y divide-border border-y border-border">{milestones.map((milestone) => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm text-white">{milestone.title}</p><p className="mt-1 text-xs text-amber-300">{milestone.requiresClientApproval ? `Client approval · ${milestone.approvalStatus.toLowerCase().replace('_', ' ')}` : 'No client approval required'}</p></div><span className="text-xs text-muted-foreground">{milestone.status.replace('_', ' ').toLowerCase()}</span></div>)}</div>}
      </section>}

      {tab === 'Meetings' && <section className="space-y-4">
        {!readOnly && <form onSubmit={(event) => submit(event, () => api.post(`/api/v1/projects/${projectId}/meetings`, { ...meetingForm, meetingDate: new Date(meetingForm.meetingDate).toISOString() }))} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><input required value={meetingForm.title} onChange={(event) => setMeetingForm({ ...meetingForm, title: event.target.value })} aria-label="Meeting title" placeholder="Meeting title" className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" /><input required type="datetime-local" value={meetingForm.meetingDate} onChange={(event) => setMeetingForm({ ...meetingForm, meetingDate: event.target.value })} aria-label="Meeting date" className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground" /><label className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><input type="checkbox" checked={meetingForm.visibleToClient} onChange={(event) => setMeetingForm({ ...meetingForm, visibleToClient: event.target.checked })} />Share with client</label><button disabled={busy} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Record</button></form>}
        {meetings.length === 0 ? <p className="border border-dashed border-input p-7 text-center text-sm text-muted-foreground">No meetings recorded.</p> : <div className="divide-y divide-border border-y border-border">{meetings.map((meeting) => {
          const summary = aiSummaries[meeting.id];
          const items = aiItems[meeting.id] ?? summary?.actionItems ?? [];
          const selected = aiSelected[meeting.id] ?? items.map(() => true);
          return <article key={meeting.id} className="space-y-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-white">{meeting.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(meeting.meetingDate).toLocaleString()}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={readOnly || aiBusyMeeting === meeting.id} onClick={() => summary ? setAiPanelMeeting(aiPanelMeeting === meeting.id ? null : meeting.id) : void generateMeetingSummary(meeting)} className="border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-50">{aiBusyMeeting === meeting.id ? 'Working…' : summary ? 'AI summary' : 'Generate AI summary'}</button><button type="button" disabled={readOnly || busy} onClick={() => void toggleMeeting(meeting)} aria-pressed={meeting.visibleToClient} className={`border px-3 py-1.5 text-xs disabled:opacity-50 ${meeting.visibleToClient ? 'border-emerald-500/40 text-emerald-300' : 'border-input text-muted-foreground'}`}>{meeting.visibleToClient ? 'Shared with client' : 'Not shared'}</button></div></div>
            {aiError && aiPanelMeeting === meeting.id && !summary && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}
            {aiPanelMeeting === meeting.id && summary && <div className="space-y-4 border border-input bg-card/50 p-4">
              <div><h3 className="text-sm font-semibold text-white">Summary</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{summary.summary}</p></div>
              <div><h3 className="text-sm font-semibold text-white">Decisions</h3>{summary.decisions.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">{summary.decisions.map((decision, index) => <li key={`${meeting.id}-decision-${index}`}>{decision}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No decisions listed.</p>}</div>
              <div className="space-y-3"><h3 className="text-sm font-semibold text-white">Action items</h3>{items.map((item, index) => <div key={`${meeting.id}-action-${index}`} className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selected[index] ?? false} onChange={(event) => setAiSelected((current) => ({ ...current, [meeting.id]: items.map((_value, itemIndex) => itemIndex === index ? event.target.checked : (current[meeting.id]?.[itemIndex] ?? true)) }))} /><input aria-label="Action item title" value={item.title} onChange={(event) => updateAiItem(meeting.id, index, 'title', event.target.value)} className="h-9 border border-input bg-background px-2 text-sm text-white" /><input aria-label="Assignee name hint" placeholder="Assignee hint" value={item.assigneeHint ?? ''} onChange={(event) => updateAiItem(meeting.id, index, 'assigneeHint', event.target.value)} className="h-9 border border-input bg-background px-2 text-sm text-white placeholder:text-muted-foreground" /><input type="date" aria-label="Due date" value={item.dueDate ?? ''} onChange={(event) => updateAiItem(meeting.id, index, 'dueDate', event.target.value)} className="h-9 border border-input bg-background px-2 text-sm text-white" /></div>)}</div>
              {aiError && aiPanelMeeting === meeting.id && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}{aiSuccess && <p role="status" className="text-sm text-emerald-200">{aiSuccess}</p>}
              <button type="button" disabled={readOnly || aiBusyMeeting === meeting.id || !items.length} onClick={() => void createSummaryTasks(meeting.id)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{aiBusyMeeting === meeting.id ? 'Creating…' : 'Create selected tasks'}</button>
            </div>}
            {aiError && aiPanelMeeting !== meeting.id && aiBusyMeeting === null && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}
          </article>;
        })}</div>}
      </section>}

      {tab === 'Members' && <section className="space-y-4">
        {!project.members.length && !isAdmin ? <p className="border border-dashed border-input p-7 text-center text-sm text-muted-foreground">No members assigned.</p> : null}
        {isAdmin && !readOnly ? <form onSubmit={(event) => submit(event, () => api.put(`/api/v1/projects/${projectId}/members`, { userIds: selectedMembers }))} className="space-y-4">
          {team.map((member) => <label key={member.id} className="flex items-center gap-3 border-b border-border py-3 text-sm text-white"><input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={(event) => setSelectedMembers(event.target.checked ? [...selectedMembers, member.id] : selectedMembers.filter((id) => id !== member.id))} />{member.name}<span className="text-xs text-muted-foreground">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</span></label>)}
          <button disabled={busy} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save members</button>
        </form> : <div className="divide-y divide-border border-y border-border">{project.members.map(({ user: member }) => <div key={member.id} className="py-3"><p className="text-sm text-white">{member.name}</p><p className="mt-1 text-xs text-muted-foreground">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</p></div>)}</div>}
      </section>}

      {tab === 'Feedback' && <section className="space-y-4">
        {feedback.length === 0 ? <p className="border border-dashed border-input p-7 text-center text-sm text-muted-foreground">No client feedback on this project.</p> : <div className="divide-y divide-border border-y border-border">{feedback.map((item) => <article key={item.id} className="space-y-4 py-5">
          <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-white">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.submitter.name} · {new Date(item.createdAt).toLocaleDateString()}</p></div><label className="flex items-center gap-2"><span className={`border px-2 py-1 text-xs ${feedbackStatusStyles[item.status] ?? feedbackStatusStyles.OPEN}`}>{item.status.replace('_', ' ').toLowerCase()}</span><select aria-label={`Status for ${item.title}`} disabled={readOnly || busy} value={item.status} onChange={(event) => void updateFeedbackStatus(item.id, event.target.value)} className="h-8 border border-input bg-card px-2 text-xs text-white disabled:opacity-50">{feedbackStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label></header>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
          <div className="space-y-3 border-l border-input pl-4">{item.comments.length === 0 ? <p className="text-xs text-muted-foreground">No replies yet.</p> : item.comments.map((comment) => <div key={comment.id}><p className="text-xs text-cyan-200">{comment.author.name} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p></div>)}
            {!readOnly && <form onSubmit={(event) => submitFeedbackComment(event, item.id)} className="flex gap-2"><input required aria-label={`Reply to ${item.title}`} placeholder="Write a reply" value={commentDrafts[item.id] ?? ''} onChange={(event) => setCommentDrafts({ ...commentDrafts, [item.id]: event.target.value })} className="h-9 min-w-0 flex-1 border border-input bg-background px-3 text-sm text-white placeholder:text-muted-foreground" /><button disabled={busy} className="h-9 border border-cyan-500/40 px-3 text-xs text-cyan-200 disabled:opacity-50">Reply</button></form>}
          </div>
        </article>)}</div>}
      </section>}

      {tab === 'Files' && <section className="space-y-4">
        {!readOnly && <form onSubmit={uploadProjectFile} className="flex flex-wrap items-center gap-3 border-b border-border pb-5"><input required type="file" aria-label="Choose project file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="min-w-0 flex-1 text-sm text-muted-foreground file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" /><button disabled={busy || !selectedFile} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Uploading…' : 'Upload file'}</button></form>}
        {files.length === 0 ? <p className="border border-dashed border-input p-7 text-center text-sm text-muted-foreground">No files uploaded.</p> : <div className="divide-y divide-border border-y border-border">{files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{file.originalName}</p><p className="mt-1 text-xs text-muted-foreground">{file.uploader.name} · {(file.sizeBytes / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><a href={`/api/v1/files/${file.id}/download`} className="border border-input px-3 py-1.5 text-xs text-muted-foreground hover:border-cyan-400">Download</a><button type="button" disabled={readOnly || busy} aria-pressed={file.visibleToClient} onClick={() => void toggleFileVisibility(file)} className={`border px-3 py-1.5 text-xs disabled:opacity-50 ${file.visibleToClient ? 'border-emerald-500/40 text-emerald-300' : 'border-input text-muted-foreground'}`}>{file.visibleToClient ? 'Shared' : 'Private'}</button>{(isAdmin || file.uploadedBy === user?.id) && !readOnly && <button type="button" disabled={busy} onClick={() => void deleteProjectFile(file.id)} className="border border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50">Delete</button>}</div></div>)}</div>}
      </section>}
    </div>
  );
}