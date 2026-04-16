const FundStatus = Object.freeze({
  ONBOARDING: "ONBOARDING",
  READY: "READY",
  OFFBOARDING: "OFFBOARDING"
});

const Screen = Object.freeze({
  FUNDS: "funds",
  MY_TASKS: "my-tasks",
  FUND_DETAIL: "fund-detail",
  FUND_TASK_DETAIL: "fund-task-detail",
  USERS: "users",
  WORKFLOWS: "workflows",
  WORKFLOW_DETAIL: "workflow-detail"
});

const WorkflowItemType = Object.freeze({
  DELAY: "DELAY",
  TASK: "TASK",
  TASK_GROUP: "TASK_GROUP"
});

const TaskStatus = Object.freeze({
  OPEN: "Otevreny",
  DONE: "Dokonceny",
  ON_HOLD: "On-hold"
});

const WorkflowRunMode = Object.freeze({
  IMMEDIATE: "immediate",
  SCHEDULED: "scheduled",
  PERIODIC: "periodic"
});

const WorkflowRunStatus = Object.freeze({
  SCHEDULED: "NAPLANOVANO NA DATUM",
  RUNNING: "SPUSTENO",
  DONE: "DOKONCENO"
});

const statusOptions = Object.values(FundStatus);
const PAGE_SIZE = 10;

function createDefaultUser() {
  return {
    id: crypto.randomUUID(),
    username: "jiri.grummich",
    password: "PrvniPrihlaseni1",
    isActive: true
  };
}

function normalizeRunMode(mode) {
  if (Object.values(WorkflowRunMode).includes(mode)) {
    return mode;
  }
  return WorkflowRunMode.IMMEDIATE;
}

function normalizeRunStatus(status) {
  if (status === "NAPLANOVANO") {
    return WorkflowRunStatus.SCHEDULED;
  }
  if (Object.values(WorkflowRunStatus).includes(status)) {
    return status;
  }
  return WorkflowRunStatus.RUNNING;
}

function createWorkflowItem(type, defaultAssigneeUserId = "") {
  const base = {
    id: crypto.randomUUID(),
    type,
    name:
      type === WorkflowItemType.DELAY
        ? "Delay"
        : type === WorkflowItemType.TASK
          ? "Task"
          : "Task group",
    followUpTaskIds: []
  };

  if (type === WorkflowItemType.DELAY) {
    return {
      ...base,
      delayDays: 1
    };
  }

  if (type === WorkflowItemType.TASK) {
    return {
      ...base,
      taskGroupId: "",
      assigneeUserId: defaultAssigneeUserId,
      status: TaskStatus.OPEN,
      completedDate: "",
      note: "",
      files: "",
      deadlineOffsetDays: 5
    };
  }

  return { ...base };
}

function createWorkflow(name) {
  const defaultAssigneeUserId = users[0]?.id || "";
  return {
    id: crypto.randomUUID(),
    name,
    items: [createWorkflowItem(WorkflowItemType.TASK, defaultAssigneeUserId)]
  };
}

function createDefaultState() {
  const defaultUser = createDefaultUser();

  return {
    funds: [
      {
        id: crypto.randomUUID(),
        name: "Zakladni fond",
        status: FundStatus.ONBOARDING,
        workflowRuns: []
      }
    ],
    users: [defaultUser],
    workflows: [
      {
        id: crypto.randomUUID(),
        name: "Uvodni workflow",
        items: [createWorkflowItem(WorkflowItemType.TASK, defaultUser.id)]
      }
    ]
  };
}

function normalizeWorkflowItem(item, fallbackAssigneeUserId) {
  const type = item?.type;
  const base = {
    id: item?.id || crypto.randomUUID(),
    type,
    name: item?.name || (type === WorkflowItemType.DELAY ? "Delay" : type === WorkflowItemType.TASK ? "Task" : "Task group"),
    followUpTaskIds: Array.isArray(item?.followUpTaskIds) ? item.followUpTaskIds.filter((id) => typeof id === "string") : []
  };

  if (type === WorkflowItemType.DELAY) {
    return {
      ...base,
      delayDays: Number.isFinite(Number(item?.delayDays)) ? Math.max(0, Number(item.delayDays)) : 1
    };
  }

  if (type === WorkflowItemType.TASK) {
    return {
      ...base,
      taskGroupId: typeof item?.taskGroupId === "string" ? item.taskGroupId : "",
      assigneeUserId: typeof item?.assigneeUserId === "string" ? item.assigneeUserId : fallbackAssigneeUserId,
      status: Object.values(TaskStatus).includes(item?.status) ? item.status : TaskStatus.OPEN,
      completedDate: typeof item?.completedDate === "string" ? item.completedDate : "",
      note: typeof item?.note === "string" ? item.note : "",
      files: typeof item?.files === "string" ? item.files : "",
      deadlineOffsetDays: Number.isFinite(Number(item?.deadlineOffsetDays)) ? Math.max(0, Number(item.deadlineOffsetDays)) : 5
    };
  }

  return base;
}

function toDateOnlyString(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(baseDateString, days) {
  const base = new Date(baseDateString || new Date().toISOString());
  if (Number.isNaN(base.getTime())) {
    return toDateOnlyString(new Date());
  }
  base.setDate(base.getDate() + Math.max(0, Number(days) || 0));
  return toDateOnlyString(base);
}

function normalizeWorkflowRunTask(task, runCreatedAt) {
  const deadlineOffsetDays = Number.isFinite(Number(task?.deadlineOffsetDays)) ? Math.max(0, Number(task.deadlineOffsetDays)) : 0;
  const createdAt = typeof task?.createdAt === "string" ? task.createdAt : runCreatedAt;
  const deadlineDate = typeof task?.deadlineDate === "string" && task.deadlineDate
    ? task.deadlineDate
    : addDaysToDateString(createdAt, deadlineOffsetDays);

  return {
    id: task?.id || crypto.randomUUID(),
    workflowItemId: typeof task?.workflowItemId === "string" ? task.workflowItemId : "",
    name: typeof task?.name === "string" ? task.name : "Task",
    assigneeUserId: typeof task?.assigneeUserId === "string" ? task.assigneeUserId : "",
    taskGroupId: typeof task?.taskGroupId === "string" ? task.taskGroupId : "",
    deadlineOffsetDays,
    createdAt,
    deadlineDate,
    status: Object.values(TaskStatus).includes(task?.status) ? task.status : TaskStatus.OPEN,
    note: typeof task?.note === "string" ? task.note : "",
    attachments: Array.isArray(task?.attachments)
      ? task.attachments
          .filter((attachment) => attachment && typeof attachment.name === "string")
          .map((attachment) => ({
            id: attachment.id || crypto.randomUUID(),
            uploadId: typeof attachment.uploadId === "string" ? attachment.uploadId : "",
            name: attachment.name,
            url: typeof attachment.url === "string" ? attachment.url : "",
            storageKey: typeof attachment.storageKey === "string" ? attachment.storageKey : "",
            uploadedByUserId: typeof attachment.uploadedByUserId === "string" ? attachment.uploadedByUserId : "",
            uploadedAt: typeof attachment.uploadedAt === "string" ? attachment.uploadedAt : new Date().toISOString(),
            sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Number(attachment.sizeBytes)) : 0
          }))
      : []
  };
}

function normalizeWorkflowRun(run) {
  const createdAt = typeof run?.createdAt === "string" ? run.createdAt : new Date().toISOString();

  return {
    id: run?.id || crypto.randomUUID(),
    workflowId: typeof run?.workflowId === "string" ? run.workflowId : "",
    workflowName: typeof run?.workflowName === "string" ? run.workflowName : "Workflow",
    mode: normalizeRunMode(run?.mode),
    status: normalizeRunStatus(run?.status),
    scheduledDate: typeof run?.scheduledDate === "string" ? run.scheduledDate : "",
    periodicEveryMonths: Number.isFinite(Number(run?.periodicEveryMonths)) ? Math.max(1, Number(run.periodicEveryMonths)) : 1,
    periodicDayInMonth: Number.isFinite(Number(run?.periodicDayInMonth)) ? Math.min(31, Math.max(1, Number(run.periodicDayInMonth))) : 1,
    createdAt,
    tasks: Array.isArray(run?.tasks) ? run.tasks.map((task) => normalizeWorkflowRunTask(task, createdAt)) : []
  };
}

function normalizeLoadedState(parsed) {
  const defaults = createDefaultState();

  const loadedUsers = Array.isArray(parsed?.users)
    ? parsed.users
        .filter((user) => user && typeof user.username === "string" && typeof user.password === "string")
        .map((user) => ({
          id: user.id || crypto.randomUUID(),
          username: user.username,
          password: user.password,
          isActive: Boolean(user.isActive)
        }))
    : [];

  const usersResult = loadedUsers.length > 0 ? loadedUsers : defaults.users;
  const fallbackAssigneeUserId = usersResult[0]?.id || "";

  const fundsResult = Array.isArray(parsed?.funds)
    ? parsed.funds
        .filter((fund) => fund && typeof fund.name === "string")
        .map((fund) => ({
          id: fund.id || crypto.randomUUID(),
          name: fund.name,
          status: Object.values(FundStatus).includes(fund.status) ? fund.status : FundStatus.ONBOARDING,
          workflowRuns: Array.isArray(fund.workflowRuns) ? fund.workflowRuns.map((run) => normalizeWorkflowRun(run)) : []
        }))
    : [];

  const workflowsResult = Array.isArray(parsed?.workflows)
    ? parsed.workflows
        .filter((workflow) => workflow && typeof workflow.name === "string")
        .map((workflow) => ({
          id: workflow.id || crypto.randomUUID(),
          name: workflow.name,
          items: Array.isArray(workflow.items)
            ? workflow.items
                .map((item) => normalizeWorkflowItem(item, fallbackAssigneeUserId))
                .filter((item) => Object.values(WorkflowItemType).includes(item.type))
            : [createWorkflowItem(WorkflowItemType.TASK, fallbackAssigneeUserId)]
        }))
    : [];

  return {
    funds: fundsResult.length > 0 ? fundsResult : defaults.funds,
    users: usersResult,
    workflows: workflowsResult.length > 0 ? workflowsResult : defaults.workflows
  };
}

let funds = [];
let users = [];
let workflows = [];
let stateVersion = null;

let persistTimerId = null;
let pendingPersistSnapshot = null;
let persistInFlight = Promise.resolve();

async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = data?.message || `Request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function loadAppStateFromApi() {
  try {
    const response = await apiRequest("/api/state");
    return {
      state: normalizeLoadedState(response?.state || {}),
      version: Number.isInteger(Number(response?.version)) ? Number(response.version) : 0
    };
  } catch (error) {
    console.error("Failed to load state from API, using defaults", error);
    return {
      state: createDefaultState(),
      version: null
    };
  }
}

function applyLoadedState(loadedState) {
  funds = loadedState.state.funds;
  users = loadedState.state.users;
  workflows = loadedState.state.workflows;
  stateVersion = loadedState.version;
}

async function reloadStateAfterConflict() {
  if (persistTimerId !== null) {
    clearTimeout(persistTimerId);
    persistTimerId = null;
  }

  pendingPersistSnapshot = null;
  await discardTaskDetailDraft();

  const loadedState = await loadAppStateFromApi();
  applyLoadedState(loadedState);

  editingUserId = null;
  selectedWorkflowId = null;
  selectedFundId = null;
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  previousTaskScreen = Screen.FUND_DETAIL;
  resetMyTasksFilters();
  paginationState.myTasks = 1;

  renderFunds();
  renderUsers();
  renderWorkflows();
  setActiveScreen(Screen.FUNDS);
  alert("Data byla mezitim zmenena v jine relaci. Aplikace nacetla aktualni stav ze serveru.");
}

function queuePersistSnapshot(snapshot) {
  pendingPersistSnapshot = snapshot;

  if (persistTimerId !== null) {
    clearTimeout(persistTimerId);
  }

  persistTimerId = window.setTimeout(() => {
    const stateToPersist = pendingPersistSnapshot;
    pendingPersistSnapshot = null;
    persistTimerId = null;

    persistInFlight = persistInFlight
      .catch(() => {})
      .then(() =>
        apiRequest("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: stateToPersist,
            expectedVersion: stateVersion
          })
        })
      )
      .then((response) => {
        stateVersion = Number.isInteger(Number(response?.version)) ? Number(response.version) : stateVersion;
      })
      .catch((error) => {
        if (error.status === 409) {
          return reloadStateAfterConflict();
        }
        console.error("Failed to persist state to API", error);
      });
  }, 200);
}

function persistAppState() {
  queuePersistSnapshot({
    funds,
    users,
    workflows
  });
}

async function uploadAttachmentFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/uploads", {
    method: "POST",
    body: formData
  });
}

async function deleteUploadedAttachment(uploadId) {
  if (!uploadId) {
    return;
  }
  try {
    await apiRequest(`/api/uploads/${uploadId}`, { method: "DELETE" });
  } catch (error) {
    console.error("Failed to delete uploaded file", error);
  }
}

function cloneAttachments(attachments) {
  return Array.isArray(attachments) ? attachments.map((attachment) => ({ ...attachment })) : [];
}

function getAttachmentUploadIds(attachments) {
  return new Set(
    (Array.isArray(attachments) ? attachments : [])
      .map((attachment) => attachment?.uploadId)
      .filter((uploadId) => typeof uploadId === "string" && uploadId)
  );
}

function getRemovedTaskDetailUploadIds() {
  const originalUploadIds = getAttachmentUploadIds(taskDetailOriginalAttachments);
  const currentUploadIds = getAttachmentUploadIds(taskDetailDraft?.attachments);
  return [...originalUploadIds].filter((uploadId) => !currentUploadIds.has(uploadId));
}

function getUnsavedTaskDetailUploadIds() {
  const originalUploadIds = getAttachmentUploadIds(taskDetailOriginalAttachments);
  const currentUploadIds = getAttachmentUploadIds(taskDetailDraft?.attachments);
  return [...currentUploadIds].filter((uploadId) => !originalUploadIds.has(uploadId));
}

async function deleteUploadedAttachments(uploadIds) {
  await Promise.all(uploadIds.map((uploadId) => deleteUploadedAttachment(uploadId)));
}

async function discardTaskDetailDraft() {
  if (taskDetailDraft) {
    await deleteUploadedAttachments(getUnsavedTaskDetailUploadIds());
  }

  taskDetailDraft = null;
  taskDetailOriginalAttachments = [];
}

let currentScreen = Screen.FUNDS;
let editingUserId = null;
let selectedWorkflowId = null;
let selectedFundId = null;
let selectedWorkflowRunId = null;
let selectedRunTaskId = null;
let taskDetailDraft = null;
let taskDetailOriginalAttachments = [];
let currentUserId = null;
let previousTaskScreen = Screen.FUND_DETAIL;
let myTasksFilters = {
  ownerUserId: "",
  status: TaskStatus.OPEN,
  fundId: "all"
};
const paginationState = {
  funds: 1,
  myTasks: 1,
  users: 1,
  workflows: 1,
  fundRuns: 1,
  runTasks: 1,
  attachments: 1
};

const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

const screenTitle = document.getElementById("screenTitle");
const menuFundsButton = document.getElementById("menuFundsButton");
const menuMyTasksButton = document.getElementById("menuMyTasksButton");
const menuUsersButton = document.getElementById("menuUsersButton");
const menuWorkflowsButton = document.getElementById("menuWorkflowsButton");
const logoutButton = document.getElementById("logoutButton");
const fundsScreen = document.getElementById("fundsScreen");
const myTasksScreen = document.getElementById("myTasksScreen");
const myTasksOwnerFilter = document.getElementById("myTasksOwnerFilter");
const myTasksStatusFilter = document.getElementById("myTasksStatusFilter");
const myTasksFundFilter = document.getElementById("myTasksFundFilter");
const myTasksTableBody = document.getElementById("myTasksTableBody");
const fundsPagination = document.getElementById("fundsPagination");
const myTasksPagination = document.getElementById("myTasksPagination");
const usersPagination = document.getElementById("usersPagination");
const workflowsPagination = document.getElementById("workflowsPagination");
const fundRunsPagination = document.getElementById("fundRunsPagination");
const runTasksPagination = document.getElementById("runTasksPagination");
const attachmentsPagination = document.getElementById("attachmentsPagination");
const fundDetailScreen = document.getElementById("fundDetailScreen");
const fundDetailTitle = document.getElementById("fundDetailTitle");
const backToFundsButton = document.getElementById("backToFundsButton");
const runWorkflowButton = document.getElementById("runWorkflowButton");
const fundWorkflowRunTableBody = document.getElementById("fundWorkflowRunTableBody");
const fundRunTasksPanel = document.getElementById("fundRunTasksPanel");
const fundRunTasksTitle = document.getElementById("fundRunTasksTitle");
const fundRunTaskTableBody = document.getElementById("fundRunTaskTableBody");
const fundTaskDetailScreen = document.getElementById("fundTaskDetailScreen");
const backToFundWorkflowsButton = document.getElementById("backToFundWorkflowsButton");
const fundTaskDetailTitle = document.getElementById("fundTaskDetailTitle");
const taskAttrFund = document.getElementById("taskAttrFund");
const taskAttrWorkflow = document.getElementById("taskAttrWorkflow");
const taskAttrTaskGroup = document.getElementById("taskAttrTaskGroup");
const taskAttrAssignee = document.getElementById("taskAttrAssignee");
const taskAttrDeadline = document.getElementById("taskAttrDeadline");
const taskDetailStatusSelect = document.getElementById("taskDetailStatusSelect");
const taskDetailNoteInput = document.getElementById("taskDetailNoteInput");
const taskAttachmentInput = document.getElementById("taskAttachmentInput");
const taskAttachmentTableBody = document.getElementById("taskAttachmentTableBody");
const saveTaskDetailButton = document.getElementById("saveTaskDetailButton");

const usersScreen = document.getElementById("usersScreen");
const workflowsScreen = document.getElementById("workflowsScreen");
const workflowDetailScreen = document.getElementById("workflowDetailScreen");
const workflowDetailTitle = document.getElementById("workflowDetailTitle");
const backToWorkflowsButton = document.getElementById("backToWorkflowsButton");
const workflowDetailNameInput = document.getElementById("workflowDetailNameInput");
const workflowDetailMessage = document.getElementById("workflowDetailMessage");
const workflowItemsContainer = document.getElementById("workflowItemsContainer");
const addDelayItemButton = document.getElementById("addDelayItemButton");
const addTaskItemButton = document.getElementById("addTaskItemButton");
const addTaskGroupItemButton = document.getElementById("addTaskGroupItemButton");

const fundTableBody = document.getElementById("fundTableBody");
const addFundButton = document.getElementById("addFundButton");
const addFundDialog = document.getElementById("addFundDialog");
const addFundForm = document.getElementById("addFundForm");
const cancelDialogButton = document.getElementById("cancelDialogButton");
const fundNameInput = document.getElementById("fundNameInput");

const userTableBody = document.getElementById("userTableBody");
const addUserButton = document.getElementById("addUserButton");
const userDialog = document.getElementById("userDialog");
const userDialogTitle = document.getElementById("userDialogTitle");
const userForm = document.getElementById("userForm");
const newUsernameInput = document.getElementById("newUsernameInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const userDialogError = document.getElementById("userDialogError");
const cancelUserDialogButton = document.getElementById("cancelUserDialogButton");

const workflowTableBody = document.getElementById("workflowTableBody");
const addWorkflowButton = document.getElementById("addWorkflowButton");
const workflowDialog = document.getElementById("workflowDialog");
const workflowForm = document.getElementById("workflowForm");
const workflowNameInput = document.getElementById("workflowNameInput");
const workflowDialogError = document.getElementById("workflowDialogError");
const cancelWorkflowDialogButton = document.getElementById("cancelWorkflowDialogButton");

const runWorkflowDialog = document.getElementById("runWorkflowDialog");
const runWorkflowForm = document.getElementById("runWorkflowForm");
const runWorkflowSelect = document.getElementById("runWorkflowSelect");
const runModeScheduledFields = document.getElementById("runModeScheduledFields");
const runModePeriodicFields = document.getElementById("runModePeriodicFields");
const runWorkflowScheduledDate = document.getElementById("runWorkflowScheduledDate");
const runWorkflowEveryMonths = document.getElementById("runWorkflowEveryMonths");
const runWorkflowDayInMonth = document.getElementById("runWorkflowDayInMonth");
const runWorkflowError = document.getElementById("runWorkflowError");
const cancelRunWorkflowDialogButton = document.getElementById("cancelRunWorkflowDialogButton");

function findUserById(userId) {
  return users.find((user) => user.id === userId);
}

function findFundById(fundId) {
  return funds.find((fund) => fund.id === fundId);
}

function findWorkflowById(workflowId) {
  return workflows.find((workflow) => workflow.id === workflowId);
}

function findWorkflowItemById(workflow, itemId) {
  return workflow.items.find((item) => item.id === itemId);
}

function findWorkflowRunById(fund, runId) {
  if (!fund || !Array.isArray(fund.workflowRuns)) {
    return null;
  }
  return fund.workflowRuns.find((run) => run.id === runId) || null;
}

function getSelectedWorkflow() {
  if (!selectedWorkflowId) {
    return null;
  }
  return findWorkflowById(selectedWorkflowId) || null;
}

function setLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function clearLoginError() {
  loginError.classList.add("hidden");
}

function showAuthenticatedApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

function showLoginScreen() {
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

function clampPage(page, totalPages) {
  return Math.max(1, Math.min(page, totalPages));
}

function paginateItems(items, key) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  paginationState[key] = clampPage(paginationState[key] || 1, totalPages);
  const start = (paginationState[key] - 1) * PAGE_SIZE;
  const pageItems = safeItems.slice(start, start + PAGE_SIZE);

  return {
    pageItems,
    totalItems,
    totalPages,
    page: paginationState[key]
  };
}

function renderPagination(container, key, totalItems, totalPages, page) {
  if (!container) {
    return;
  }

  if (totalItems === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button type="button" class="small-btn ghost" data-action="page-prev" data-page-key="${key}" ${page <= 1 ? "disabled" : ""}>Predchozi</button>
    <span class="pagination-info">Strana ${page} z ${totalPages}</span>
    <button type="button" class="small-btn ghost" data-action="page-next" data-page-key="${key}" ${page >= totalPages ? "disabled" : ""}>Dalsi</button>
  `;
}

function rerenderByPaginationKey(key) {
  if (key === "funds") {
    renderFunds();
    return;
  }
  if (key === "myTasks") {
    renderMyTasks();
    return;
  }
  if (key === "users") {
    renderUsers();
    return;
  }
  if (key === "workflows") {
    renderWorkflows();
    return;
  }
  if (key === "fundRuns" || key === "runTasks") {
    const fund = findFundById(selectedFundId);
    if (fund) {
      renderFundWorkflowRuns(fund);
    }
    return;
  }
  if (key === "attachments") {
    renderTaskAttachmentRows();
  }
}

function wirePagination(container) {
  if (!container) {
    return;
  }

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    const key = target.dataset.pageKey;
    if (!action || !key) {
      return;
    }

    if (action === "page-prev") {
      paginationState[key] = Math.max(1, (paginationState[key] || 1) - 1);
      rerenderByPaginationKey(key);
      return;
    }

    if (action === "page-next") {
      paginationState[key] = (paginationState[key] || 1) + 1;
      rerenderByPaginationKey(key);
    }
  });
}

function resetMyTasksFilters() {
  myTasksFilters = {
    ownerUserId: currentUserId || "",
    status: TaskStatus.OPEN,
    fundId: "all"
  };
}

function buildMyTasksOwnerFilterOptions() {
  const userOptions = users
    .filter((user) => user.isActive)
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === myTasksFilters.ownerUserId ? "selected" : ""}>${user.username}</option>`
    )
    .join("");

  myTasksOwnerFilter.innerHTML = userOptions || '<option value="">-- Zadny uzivatel --</option>';
}

function buildMyTasksFundFilterOptions() {
  const fundOptions = funds
    .map((fund) => `<option value="${fund.id}" ${fund.id === myTasksFilters.fundId ? "selected" : ""}>${fund.name}</option>`)
    .join("");

  myTasksFundFilter.innerHTML = `<option value="all" ${myTasksFilters.fundId === "all" ? "selected" : ""}>Vse</option>${fundOptions}`;
}

function collectAllRunTasks() {
  return funds.flatMap((fund) => {
    const runs = Array.isArray(fund.workflowRuns) ? fund.workflowRuns : [];
    return runs.flatMap((run) => {
      const tasks = Array.isArray(run.tasks) ? run.tasks : [];
      return tasks.map((task) => ({
        fundId: fund.id,
        fundName: fund.name,
        runId: run.id,
        workflowName: run.workflowName,
        task
      }));
    });
  });
}

function deadlineSortValue(deadlineDate) {
  const parsed = Date.parse(deadlineDate || "");
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function renderMyTasks() {
  buildMyTasksOwnerFilterOptions();
  buildMyTasksFundFilterOptions();
  myTasksStatusFilter.value = myTasksFilters.status;

  const rows = collectAllRunTasks()
    .filter((row) => {
      if (myTasksFilters.ownerUserId && row.task.assigneeUserId !== myTasksFilters.ownerUserId) {
        return false;
      }
      if (myTasksFilters.status !== "all" && row.task.status !== myTasksFilters.status) {
        return false;
      }
      if (myTasksFilters.fundId !== "all" && row.fundId !== myTasksFilters.fundId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => deadlineSortValue(a.task.deadlineDate) - deadlineSortValue(b.task.deadlineDate));

  const paged = paginateItems(rows, "myTasks");

  if (!paged.totalItems) {
    myTasksTableBody.innerHTML = '<tr><td colspan="6">Zadny ukol pro zvolene filtry.</td></tr>';
    renderPagination(myTasksPagination, "myTasks", 0, 1, 1);
    return;
  }

  myTasksTableBody.innerHTML = paged.pageItems
    .map((row) => {
      const assignee = findUserById(row.task.assigneeUserId)?.username || "-";
      const statusClass =
        row.task.status === TaskStatus.DONE ? "done" : row.task.status === TaskStatus.ON_HOLD ? "scheduled" : "running";

      return `
        <tr>
          <td><button type="button" class="link-btn" data-action="open-my-task" data-fund-id="${row.fundId}" data-run-id="${row.runId}" data-task-id="${row.task.id}">${row.task.name}</button></td>
          <td>${row.fundName}</td>
          <td>${row.workflowName}</td>
          <td>${assignee}</td>
          <td>${row.task.deadlineDate || "-"}</td>
          <td><span class="run-status ${statusClass}">${row.task.status}</span></td>
        </tr>
      `;
    })
    .join("");

  renderPagination(myTasksPagination, "myTasks", paged.totalItems, paged.totalPages, paged.page);
}

function setActiveScreen(screen) {
  currentScreen = screen;

  const showFunds = screen === Screen.FUNDS;
  const showMyTasks = screen === Screen.MY_TASKS;
  const showFundDetail = screen === Screen.FUND_DETAIL;
  const showFundTaskDetail = screen === Screen.FUND_TASK_DETAIL;
  const showUsers = screen === Screen.USERS;
  const showWorkflows = screen === Screen.WORKFLOWS;
  const showWorkflowDetail = screen === Screen.WORKFLOW_DETAIL;

  const taskDetailFromMyTasks = showFundTaskDetail && previousTaskScreen === Screen.MY_TASKS;

  if (showFunds || showFundDetail || (showFundTaskDetail && !taskDetailFromMyTasks)) {
    screenTitle.textContent = "Fondy";
  }
  if (showMyTasks || taskDetailFromMyTasks) {
    screenTitle.textContent = "Moje ukoly";
  }
  if (showUsers) {
    screenTitle.textContent = "Uzivatele";
  }
  if (showWorkflows || showWorkflowDetail) {
    screenTitle.textContent = "Workflows";
  }

  fundsScreen.classList.toggle("hidden", !showFunds);
  myTasksScreen.classList.toggle("hidden", !showMyTasks);
  fundDetailScreen.classList.toggle("hidden", !showFundDetail);
  fundTaskDetailScreen.classList.toggle("hidden", !showFundTaskDetail);
  usersScreen.classList.toggle("hidden", !showUsers);
  workflowsScreen.classList.toggle("hidden", !showWorkflows);
  workflowDetailScreen.classList.toggle("hidden", !showWorkflowDetail);

  addFundButton.classList.toggle("hidden", !showFunds);
  addUserButton.classList.toggle("hidden", !showUsers);
  addWorkflowButton.classList.toggle("hidden", !showWorkflows);

  menuFundsButton.classList.toggle("active", showFunds || showFundDetail || (showFundTaskDetail && !taskDetailFromMyTasks));
  menuMyTasksButton.classList.toggle("active", showMyTasks || taskDetailFromMyTasks);
  menuUsersButton.classList.toggle("active", showUsers);
  menuWorkflowsButton.classList.toggle("active", showWorkflows || showWorkflowDetail);

  if (showMyTasks) {
    renderMyTasks();
  }
}

function showWorkflowMessage(message) {
  workflowDetailMessage.textContent = message;
  workflowDetailMessage.classList.remove("hidden");
}

function clearWorkflowMessage() {
  workflowDetailMessage.classList.add("hidden");
}

function formatItemType(type) {
  if (type === WorkflowItemType.DELAY) {
    return "Delay";
  }
  if (type === WorkflowItemType.TASK) {
    return "Task";
  }
  return "Task group";
}

function userSelectOptions(selectedUserId) {
  return users
    .filter((user) => user.isActive)
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === selectedUserId ? "selected" : ""}>${user.username}</option>`
    )
    .join("");
}

function taskStatusOptions(selectedStatus) {
  return Object.values(TaskStatus)
    .map((status) => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`)
    .join("");
}

function buildFollowUpTaskOptions(workflow, currentItemId, selectedTaskId) {
  const taskItems = workflow.items.filter(
    (item) => item.type === WorkflowItemType.TASK && item.id !== currentItemId
  );

  if (taskItems.length === 0) {
    return '<option value="">-- Zadny task --</option>';
  }

  const defaultOption = '<option value="">-- Vyber task --</option>';
  const taskOptions = taskItems
    .map((task) => `<option value="${task.id}" ${task.id === selectedTaskId ? "selected" : ""}>${task.name}</option>`)
    .join("");

  return defaultOption + taskOptions;
}

function buildFollowUpTaskRows(workflow, item) {
  if (!item.followUpTaskIds || item.followUpTaskIds.length === 0) {
    return '<p class="inline-help">Zatim bez navazujicich tasku.</p>';
  }

  return item.followUpTaskIds
    .map((taskId, index) => {
      return `
        <div class="followup-row">
          <select data-action="followup-task-id" data-item-id="${item.id}" data-followup-index="${index}">
            ${buildFollowUpTaskOptions(workflow, item.id, taskId)}
          </select>
          <button type="button" class="small-btn ghost" data-action="remove-followup-task" data-item-id="${item.id}" data-followup-index="${index}">Odebrat</button>
        </div>
      `;
    })
    .join("");
}

function isTaskGroupCompleted(workflow, groupItem) {
  const groupTasks = workflow.items.filter(
    (item) => item.type === WorkflowItemType.TASK && item.taskGroupId === groupItem.id
  );
  if (groupTasks.length === 0) {
    return false;
  }
  return groupTasks.every((task) => task.status === TaskStatus.DONE);
}

function buildTaskGroupSelectOptions(workflow, selectedGroupId) {
  const groups = workflow.items.filter((item) => item.type === WorkflowItemType.TASK_GROUP);
  const noneOption = `<option value="" ${!selectedGroupId ? "selected" : ""}>-- Zadna skupina --</option>`;
  const groupOptions = groups
    .map((g) => `<option value="${g.id}" ${g.id === selectedGroupId ? "selected" : ""}>${g.name}</option>`)
    .join("");
  return noneOption + groupOptions;
}

function buildItemCard(workflow, item, index) {
  const commonTop = `
    <div class="wf-item-head">
      <div>
        <span class="wf-index">#${index + 1}</span>
        <span class="wf-type">${formatItemType(item.type)}</span>
      </div>
      <div class="inline-btns">
        <button type="button" class="small-btn ghost" data-action="move-up" data-item-id="${item.id}">Nahoru</button>
        <button type="button" class="small-btn ghost" data-action="move-down" data-item-id="${item.id}">Dolu</button>
        <button type="button" class="small-btn ghost" data-action="remove-item" data-item-id="${item.id}">Odebrat</button>
      </div>
    </div>
    <div class="wf-field">
      <label>Nazev</label>
      <input type="text" data-action="item-name" data-item-id="${item.id}" value="${item.name}" />
    </div>
  `;

  if (item.type === WorkflowItemType.DELAY) {
    return `
      <article class="wf-item-card">
        ${commonTop}
        <div class="wf-field narrow">
          <label>Delay ve dnech</label>
          <input type="number" min="0" data-action="delay-days" data-item-id="${item.id}" value="${item.delayDays}" />
        </div>
      </article>
    `;
  }

  if (item.type === WorkflowItemType.TASK) {
    return `
      <article class="wf-item-card">
        ${commonTop}
        <div class="wf-grid-3">
          <div class="wf-field">
            <label>Prirazeny uzivatel</label>
            <select data-action="task-assignee" data-item-id="${item.id}">${userSelectOptions(item.assigneeUserId)}</select>
          </div>
          <div class="wf-field">
            <label>Stav</label>
            <select data-action="task-status" data-item-id="${item.id}">${taskStatusOptions(item.status)}</select>
          </div>
          <div class="wf-field">
            <label>Task group</label>
            <select data-action="task-group-id" data-item-id="${item.id}">${buildTaskGroupSelectOptions(workflow, item.taskGroupId)}</select>
          </div>
          <div class="wf-field">
            <label>Deadline (CREATE DATE + X dni)</label>
            <input type="number" min="0" data-action="task-deadline-offset" data-item-id="${item.id}" value="${item.deadlineOffsetDays}" />
          </div>
        </div>

        <div class="wf-followup-block">
          <h4>Po splneni tasku vytvorit dalsi tasky</h4>
          <div class="followup-list">${buildFollowUpTaskRows(workflow, item)}</div>
          <div class="inline-btns">
            <button type="button" class="small-btn" data-action="add-followup-task" data-item-id="${item.id}">Pridat navazujici task</button>
          </div>
        </div>
      </article>
    `;
  }

  const groupCompleted = isTaskGroupCompleted(workflow, item);

  return `
    <article class="wf-item-card">
      ${commonTop}
      <p class="inline-help">Tasky se prirazuji ke skupine pres nastaveni jednotlivych tasku. Skupina je splnena az jsou splneny vsechny tasky v ni. Stav skupiny: <strong>${groupCompleted ? "Splnena" : "Cekajici"}</strong></p>

      <div class="wf-followup-block">
        <h4>Po splneni tasku vytvorit dalsi tasky</h4>
        <div class="followup-list">${buildFollowUpTaskRows(workflow, item)}</div>
        <div class="inline-btns">
          <button type="button" class="small-btn" data-action="add-followup-task" data-item-id="${item.id}">Pridat navazujici task</button>
        </div>
      </div>
    </article>
  `;
}

function renderWorkflowItems(workflow) {
  if (workflow.items.length === 0) {
    workflowItemsContainer.innerHTML = '<p class="detail-note">Workflow zatim nema zadne itemy.</p>';
    return;
  }

  workflowItemsContainer.innerHTML = workflow.items
    .map((item, index) => buildItemCard(workflow, item, index))
    .join("");
}

function renderWorkflowDetail() {
  const workflow = getSelectedWorkflow();
  if (!workflow) {
    return;
  }

  workflowDetailTitle.textContent = `Detail workflow: ${workflow.name}`;
  workflowDetailNameInput.value = workflow.name;

  renderWorkflowItems(workflow);
}

function formatRunMode(mode) {
  if (mode === WorkflowRunMode.SCHEDULED) {
    return "Naplanovano";
  }
  if (mode === WorkflowRunMode.PERIODIC) {
    return "Periodicky";
  }
  return "Hned";
}

function formatRunPlan(run) {
  if (run.mode === WorkflowRunMode.SCHEDULED) {
    return run.scheduledDate || "-";
  }
  if (run.mode === WorkflowRunMode.PERIODIC) {
    return `Kazdy ${run.periodicEveryMonths}. mesic, ${run.periodicDayInMonth}. den`;
  }
  return "Ihned";
}

function recomputeWorkflowRunStatus(run) {
  if (!run || !Array.isArray(run.tasks)) {
    return;
  }

  const hasTasks = run.tasks.length > 0;
  const allDone = hasTasks && run.tasks.every((task) => task.status === TaskStatus.DONE);

  if (allDone) {
    run.status = WorkflowRunStatus.DONE;
    return;
  }

  if (run.status === WorkflowRunStatus.DONE) {
    run.status = WorkflowRunStatus.RUNNING;
  }
}

function buildRunTaskFromWorkflowTaskItem(taskItem, createdAt) {
  return {
    id: crypto.randomUUID(),
    workflowItemId: taskItem.id,
    name: taskItem.name,
    assigneeUserId: taskItem.assigneeUserId,
    taskGroupId: taskItem.taskGroupId,
    deadlineOffsetDays: taskItem.deadlineOffsetDays,
    createdAt,
    deadlineDate: addDaysToDateString(createdAt, taskItem.deadlineOffsetDays),
    status: TaskStatus.OPEN,
    note: "",
    attachments: []
  };
}

function isSourceItemCompletedInRun(run, workflow, sourceItem) {
  if (sourceItem.type === WorkflowItemType.TASK) {
    const sourceTask = run.tasks.find((task) => task.workflowItemId === sourceItem.id);
    return Boolean(sourceTask && sourceTask.status === TaskStatus.DONE);
  }

  if (sourceItem.type === WorkflowItemType.TASK_GROUP) {
    const groupTaskItems = workflow.items.filter(
      (item) => item.type === WorkflowItemType.TASK && item.taskGroupId === sourceItem.id
    );

    if (groupTaskItems.length === 0) {
      return false;
    }

    return groupTaskItems.every((taskItem) => {
      const runTask = run.tasks.find((task) => task.workflowItemId === taskItem.id);
      return Boolean(runTask && runTask.status === TaskStatus.DONE);
    });
  }

  return false;
}

function materializeFollowUpTasks(run, workflow, createdAt) {
  const sourceItems = workflow.items.filter(
    (item) =>
      (item.type === WorkflowItemType.TASK || item.type === WorkflowItemType.TASK_GROUP) &&
      Array.isArray(item.followUpTaskIds) &&
      item.followUpTaskIds.length > 0
  );

  sourceItems.forEach((sourceItem) => {
    if (!isSourceItemCompletedInRun(run, workflow, sourceItem)) {
      return;
    }

    sourceItem.followUpTaskIds.forEach((targetTaskId) => {
      if (!targetTaskId) {
        return;
      }

      const alreadyCreated = run.tasks.some((task) => task.workflowItemId === targetTaskId);
      if (alreadyCreated) {
        return;
      }

      const targetTaskItem = workflow.items.find(
        (item) => item.type === WorkflowItemType.TASK && item.id === targetTaskId
      );

      if (!targetTaskItem) {
        return;
      }

      run.tasks.push(buildRunTaskFromWorkflowTaskItem(targetTaskItem, createdAt));
    });
  });
}

function createWorkflowRunFromWorkflow(workflow, mode, options) {
  const createdAt = new Date().toISOString();
  const baseTaskDate =
    mode === WorkflowRunMode.SCHEDULED && options.scheduledDate
      ? `${options.scheduledDate}T00:00:00`
      : createdAt;

  const followUpTargets = new Set(
    workflow.items.flatMap((item) =>
      Array.isArray(item.followUpTaskIds) ? item.followUpTaskIds.filter((id) => typeof id === "string" && id) : []
    )
  );

  const initialTaskItems = workflow.items.filter(
    (item) => item.type === WorkflowItemType.TASK && !followUpTargets.has(item.id)
  );

  const tasks = initialTaskItems.map((taskItem) => buildRunTaskFromWorkflowTaskItem(taskItem, baseTaskDate));

  return {
    id: crypto.randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode,
    status: mode === WorkflowRunMode.IMMEDIATE ? WorkflowRunStatus.RUNNING : WorkflowRunStatus.SCHEDULED,
    scheduledDate: options.scheduledDate || "",
    periodicEveryMonths: options.periodicEveryMonths || 1,
    periodicDayInMonth: options.periodicDayInMonth || 1,
    createdAt,
    tasks
  };
}

function renderFundRunTasks(fund) {
  const run = findWorkflowRunById(fund, selectedWorkflowRunId);
  if (!run) {
    fundRunTasksPanel.classList.add("hidden");
    fundRunTaskTableBody.innerHTML = "";
    renderPagination(runTasksPagination, "runTasks", 0, 1, 1);
    return;
  }

  fundRunTasksPanel.classList.remove("hidden");
  fundRunTasksTitle.textContent = `Tasky workflow: ${run.workflowName}`;

  const paged = paginateItems(run.tasks, "runTasks");

  if (!paged.totalItems) {
    fundRunTaskTableBody.innerHTML = '<tr><td colspan="5">Workflow nevytvoril zadne tasky.</td></tr>';
    renderPagination(runTasksPagination, "runTasks", 0, 1, 1);
    return;
  }

  fundRunTaskTableBody.innerHTML = paged.pageItems
    .map((task) => {
      const assignee = findUserById(task.assigneeUserId)?.username || "-";
      const taskGroup = task.taskGroupId
        ? (findWorkflowItemById(findWorkflowById(run.workflowId) || { items: [] }, task.taskGroupId)?.name || "-")
        : "-";

      const statusClass =
        task.status === TaskStatus.DONE ? "done" : task.status === TaskStatus.ON_HOLD ? "scheduled" : "running";

      return `
        <tr>
          <td><button type="button" class="link-btn" data-action="open-run-task" data-run-id="${run.id}" data-task-id="${task.id}">${task.name}</button></td>
          <td>${assignee}</td>
          <td>${taskGroup}</td>
          <td>${task.deadlineDate || "-"}</td>
          <td><span class="run-status ${statusClass}">${task.status}</span></td>
        </tr>
      `;
    })
    .join("");

  renderPagination(runTasksPagination, "runTasks", paged.totalItems, paged.totalPages, paged.page);
}

function renderFundWorkflowRuns(fund) {
  if (!Array.isArray(fund.workflowRuns)) {
    fund.workflowRuns = [];
  }

  if (!fund.workflowRuns.length) {
    fundWorkflowRunTableBody.innerHTML = '<tr><td colspan="5">Zatim bez spustenych workflow.</td></tr>';
    renderPagination(fundRunsPagination, "fundRuns", 0, 1, 1);
    renderFundRunTasks(fund);
    return;
  }

  const paged = paginateItems(fund.workflowRuns, "fundRuns");

  fundWorkflowRunTableBody.innerHTML = paged.pageItems
    .map((run) => {
      const statusClass =
        run.status === WorkflowRunStatus.SCHEDULED
          ? "scheduled"
          : run.status === WorkflowRunStatus.DONE
            ? "done"
            : "running";

      return `
        <tr>
          <td><button type="button" class="link-btn" data-action="open-fund-run" data-run-id="${run.id}">${run.workflowName}</button></td>
          <td>${formatRunMode(run.mode)}</td>
          <td><span class="run-status ${statusClass}">${run.status}</span></td>
          <td>${formatRunPlan(run)}</td>
          <td><button type="button" class="small-btn ghost" data-action="delete-fund-run" data-run-id="${run.id}">Smazat</button></td>
        </tr>
      `;
    })
    .join("");

  renderPagination(fundRunsPagination, "fundRuns", paged.totalItems, paged.totalPages, paged.page);

  renderFundRunTasks(fund);
}

function formatBytes(sizeBytes) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function findSelectedRunTask() {
  const fund = findFundById(selectedFundId);
  if (!fund) {
    return null;
  }

  const run = findWorkflowRunById(fund, selectedWorkflowRunId);
  if (!run) {
    return null;
  }

  const task = run.tasks.find((row) => row.id === selectedRunTaskId);
  if (!task) {
    return null;
  }

  return { fund, run, task };
}

function renderTaskAttachmentRows() {
  if (!taskDetailDraft || !Array.isArray(taskDetailDraft.attachments) || taskDetailDraft.attachments.length === 0) {
    taskAttachmentTableBody.innerHTML = '<tr><td colspan="5">Zatim bez priloh.</td></tr>';
    renderPagination(attachmentsPagination, "attachments", 0, 1, 1);
    return;
  }

  const paged = paginateItems(taskDetailDraft.attachments, "attachments");

  taskAttachmentTableBody.innerHTML = paged.pageItems
    .map((attachment, offsetIndex) => {
      const index = (paged.page - 1) * PAGE_SIZE + offsetIndex;
      const uploadedBy = findUserById(attachment.uploadedByUserId)?.username || "-";
      const uploadedAt = toDateOnlyString(attachment.uploadedAt) || "-";
      const fileNameCell = attachment.url
        ? `<a href="${attachment.url}" target="_blank" rel="noopener noreferrer">${attachment.name}</a>`
        : attachment.name;
      return `
        <tr>
          <td>${fileNameCell}</td>
          <td>${uploadedBy}</td>
          <td>${uploadedAt}</td>
          <td>${formatBytes(attachment.sizeBytes)}</td>
          <td><button type="button" class="small-btn ghost" data-action="delete-task-attachment" data-attachment-index="${index}">Smazat</button></td>
        </tr>
      `;
    })
    .join("");

  renderPagination(attachmentsPagination, "attachments", paged.totalItems, paged.totalPages, paged.page);
}

function renderTaskDetail() {
  const selected = findSelectedRunTask();
  if (!selected || !taskDetailDraft) {
    return;
  }

  const { fund, run, task } = selected;
  const workflow = findWorkflowById(run.workflowId);
  const taskGroup = task.taskGroupId
    ? (findWorkflowItemById(workflow || { items: [] }, task.taskGroupId)?.name || "-")
    : "-";
  const assignee = findUserById(task.assigneeUserId)?.username || "-";

  fundTaskDetailTitle.textContent = `Detail tasku: ${task.name}`;
  taskAttrFund.textContent = fund.name;
  taskAttrWorkflow.textContent = run.workflowName;
  taskAttrTaskGroup.textContent = taskGroup;
  taskAttrAssignee.textContent = assignee;
  taskAttrDeadline.textContent = task.deadlineDate || "-";

  taskDetailStatusSelect.value = taskDetailDraft.status;
  taskDetailNoteInput.value = taskDetailDraft.note;
  renderTaskAttachmentRows();
}

function openTaskDetail(runId, taskId, sourceScreen = Screen.FUND_DETAIL) {
  const fund = findFundById(selectedFundId);
  if (!fund) {
    return;
  }

  const run = findWorkflowRunById(fund, runId);
  if (!run) {
    return;
  }

  const task = run.tasks.find((row) => row.id === taskId);
  if (!task) {
    return;
  }

  selectedWorkflowRunId = run.id;
  selectedRunTaskId = task.id;
  previousTaskScreen = sourceScreen;
  taskDetailDraft = {
    status: task.status,
    note: task.note || "",
    attachments: cloneAttachments(task.attachments)
  };
  taskDetailOriginalAttachments = cloneAttachments(task.attachments);

  renderTaskDetail();
  setActiveScreen(Screen.FUND_TASK_DETAIL);
}

function openFundDetail(fundId) {
  const fund = findFundById(fundId);
  if (!fund) {
    return;
  }

  selectedFundId = fund.id;
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  taskDetailDraft = null;
  paginationState.fundRuns = 1;
  paginationState.runTasks = 1;
  fundDetailTitle.textContent = `Detail fondu: ${fund.name}`;
  renderFundWorkflowRuns(fund);
  setActiveScreen(Screen.FUND_DETAIL);
}

function refreshRunModeFields() {
  const selectedMode = document.querySelector('input[name="runWorkflowMode"]:checked')?.value;
  runModeScheduledFields.classList.toggle("hidden", selectedMode !== WorkflowRunMode.SCHEDULED);
  runModePeriodicFields.classList.toggle("hidden", selectedMode !== WorkflowRunMode.PERIODIC);
}

function populateRunWorkflowSelect() {
  const workflowOptions = workflows
    .map((workflow) => `<option value="${workflow.id}">${workflow.name}</option>`)
    .join("");
  runWorkflowSelect.innerHTML = workflowOptions || '<option value="">-- Zadny workflow --</option>';
}

function renderFunds() {
  fundTableBody.innerHTML = "";

  const paged = paginateItems(funds, "funds");

  paged.pageItems.forEach((fund) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const fundButton = document.createElement("button");
    fundButton.type = "button";
    fundButton.className = "fund-link-btn";
    fundButton.textContent = fund.name;
    fundButton.addEventListener("click", () => {
      openFundDetail(fund.id);
    });
    nameCell.append(fundButton);

    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";

    statusOptions.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status === fund.status;
      statusSelect.append(option);
    });

    statusSelect.addEventListener("change", (event) => {
      fund.status = event.target.value;
      persistAppState();
    });

    statusCell.append(statusSelect);
    row.append(nameCell, statusCell);
    fundTableBody.append(row);
  });

  renderPagination(fundsPagination, "funds", paged.totalItems, paged.totalPages, paged.page);
}

function renderUsers() {
  userTableBody.innerHTML = "";

  const paged = paginateItems(users, "users");

  paged.pageItems.forEach((user) => {
    const row = document.createElement("tr");

    const usernameCell = document.createElement("td");
    usernameCell.textContent = user.username;

    const passwordCell = document.createElement("td");
    passwordCell.textContent = user.password;

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = `user-status ${user.isActive ? "active" : "inactive"}`;
    statusBadge.textContent = user.isActive ? "AKTIVNI" : "NEAKTIVNI";
    statusCell.append(statusBadge);

    const actionsCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "small-btn";
    editButton.textContent = "Editovat";
    editButton.addEventListener("click", () => {
      openEditUserDialog(user.id);
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "small-btn ghost";
    toggleButton.textContent = user.isActive ? "Deaktivovat" : "Aktivovat";
    toggleButton.addEventListener("click", () => {
      user.isActive = !user.isActive;
      persistAppState();
      renderUsers();
      renderWorkflowDetail();
    });

    actionsCell.append(editButton, toggleButton);
    row.append(usernameCell, passwordCell, statusCell, actionsCell);
    userTableBody.append(row);
  });

  renderPagination(usersPagination, "users", paged.totalItems, paged.totalPages, paged.page);
}

function renderWorkflows() {
  workflowTableBody.innerHTML = "";

  const paged = paginateItems(workflows, "workflows");

  paged.pageItems.forEach((workflow) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "link-btn";
    openButton.textContent = workflow.name;
    openButton.addEventListener("click", () => {
      selectedWorkflowId = workflow.id;
      clearWorkflowMessage();
      renderWorkflowDetail();
      setActiveScreen(Screen.WORKFLOW_DETAIL);
    });
    nameCell.append(openButton);
    row.append(nameCell);
    workflowTableBody.append(row);
  });

  renderPagination(workflowsPagination, "workflows", paged.totalItems, paged.totalPages, paged.page);
}

function clearUserDialogError() {
  userDialogError.classList.add("hidden");
}

function showUserDialogError(message) {
  userDialogError.textContent = message;
  userDialogError.classList.remove("hidden");
}

function openAddUserDialog() {
  editingUserId = null;
  userDialogTitle.textContent = "Novy uzivatel";
  newUsernameInput.value = "";
  newPasswordInput.value = "";
  clearUserDialogError();
  userDialog.showModal();
  newUsernameInput.focus();
}

function openEditUserDialog(userId) {
  const user = findUserById(userId);
  if (!user) {
    return;
  }

  editingUserId = user.id;
  userDialogTitle.textContent = "Editace uzivatele";
  newUsernameInput.value = user.username;
  newPasswordInput.value = user.password;
  clearUserDialogError();
  userDialog.showModal();
  newUsernameInput.focus();
}

function addWorkflowItem(type) {
  const workflow = getSelectedWorkflow();
  if (!workflow) {
    return;
  }

  workflow.items.push(createWorkflowItem(type, users[0]?.id || ""));
  persistAppState();
  clearWorkflowMessage();
  renderWorkflowDetail();
}

menuFundsButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  selectedFundId = null;
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  setActiveScreen(Screen.FUNDS);
});

menuMyTasksButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  selectedFundId = null;
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  resetMyTasksFilters();
  paginationState.myTasks = 1;
  setActiveScreen(Screen.MY_TASKS);
});

menuUsersButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  setActiveScreen(Screen.USERS);
});

menuWorkflowsButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  setActiveScreen(Screen.WORKFLOWS);
});

logoutButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  currentUserId = null;
  selectedFundId = null;
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  selectedWorkflowId = null;
  previousTaskScreen = Screen.FUND_DETAIL;
  resetMyTasksFilters();
  paginationState.myTasks = 1;

  usernameInput.value = "";
  passwordInput.value = "";
  clearLoginError();
  setActiveScreen(Screen.FUNDS);
  showLoginScreen();
  usernameInput.focus();
});

addFundButton.addEventListener("click", () => {
  addFundDialog.showModal();
  fundNameInput.value = "";
  fundNameInput.focus();
});

addUserButton.addEventListener("click", () => {
  openAddUserDialog();
});

addWorkflowButton.addEventListener("click", () => {
  workflowNameInput.value = "";
  workflowDialogError.classList.add("hidden");
  workflowDialog.showModal();
  workflowNameInput.focus();
});

backToWorkflowsButton.addEventListener("click", () => {
  setActiveScreen(Screen.WORKFLOWS);
});

backToFundsButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  selectedWorkflowRunId = null;
  selectedRunTaskId = null;
  setActiveScreen(Screen.FUNDS);
});

backToFundWorkflowsButton.addEventListener("click", async () => {
  await discardTaskDetailDraft();
  setActiveScreen(previousTaskScreen);
});

runWorkflowButton.addEventListener("click", () => {
  const fund = findFundById(selectedFundId);
  if (!fund) {
    return;
  }

  populateRunWorkflowSelect();
  runWorkflowError.classList.add("hidden");
  runWorkflowScheduledDate.value = "";
  runWorkflowEveryMonths.value = "1";
  runWorkflowDayInMonth.value = "1";

  const immediateRadio = document.querySelector('input[name="runWorkflowMode"][value="immediate"]');
  if (immediateRadio) {
    immediateRadio.checked = true;
  }

  refreshRunModeFields();
  runWorkflowDialog.showModal();
});

cancelRunWorkflowDialogButton.addEventListener("click", () => {
  runWorkflowDialog.close();
});

document.querySelectorAll('input[name="runWorkflowMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    refreshRunModeFields();
  });
});

runWorkflowForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const fund = findFundById(selectedFundId);
  if (!fund) {
    return;
  }

  const workflow = findWorkflowById(runWorkflowSelect.value);
  if (!workflow) {
    runWorkflowError.textContent = "Vyberte workflow.";
    runWorkflowError.classList.remove("hidden");
    return;
  }

  const mode = document.querySelector('input[name="runWorkflowMode"]:checked')?.value || WorkflowRunMode.IMMEDIATE;
  const options = {
    scheduledDate: "",
    periodicEveryMonths: 1,
    periodicDayInMonth: 1
  };

  if (mode === WorkflowRunMode.SCHEDULED) {
    if (!runWorkflowScheduledDate.value) {
      runWorkflowError.textContent = "Vyberte datum spusteni.";
      runWorkflowError.classList.remove("hidden");
      return;
    }
    options.scheduledDate = runWorkflowScheduledDate.value;
  }

  if (mode === WorkflowRunMode.PERIODIC) {
    const everyMonths = Number(runWorkflowEveryMonths.value);
    const dayInMonth = Number(runWorkflowDayInMonth.value);
    if (Number.isNaN(everyMonths) || everyMonths < 1 || Number.isNaN(dayInMonth) || dayInMonth < 1 || dayInMonth > 31) {
      runWorkflowError.textContent = "Zadejte validni periodu (X mesic, Y den).";
      runWorkflowError.classList.remove("hidden");
      return;
    }
    options.periodicEveryMonths = everyMonths;
    options.periodicDayInMonth = dayInMonth;
  }

  const workflowRun = createWorkflowRunFromWorkflow(workflow, mode, options);
  fund.workflowRuns = Array.isArray(fund.workflowRuns) ? fund.workflowRuns : [];
  fund.workflowRuns.push(workflowRun);
  selectedWorkflowRunId = workflowRun.id;
  persistAppState();
  renderFundWorkflowRuns(fund);
  runWorkflowDialog.close();
});

fundWorkflowRunTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const fund = findFundById(selectedFundId);
  if (!fund) {
    return;
  }

  if (target.dataset.action === "open-fund-run") {
    const run = findWorkflowRunById(fund, target.dataset.runId);
    if (!run) {
      return;
    }

    selectedWorkflowRunId = run.id;
    selectedRunTaskId = null;
    paginationState.runTasks = 1;
    renderFundRunTasks(fund);
    return;
  }

  if (target.dataset.action === "delete-fund-run") {
    const run = findWorkflowRunById(fund, target.dataset.runId);
    if (!run) {
      return;
    }

    const confirmed = confirm(`Smazat workflow ${run.workflowName} a vsechny jeho tasky?`);
    if (!confirmed) {
      return;
    }

    fund.workflowRuns = fund.workflowRuns.filter((item) => item.id !== run.id);
    if (selectedWorkflowRunId === run.id) {
      selectedWorkflowRunId = null;
      selectedRunTaskId = null;
      taskDetailDraft = null;
    }

    persistAppState();
    renderFundWorkflowRuns(fund);
  }
});

fundRunTaskTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.dataset.action !== "open-run-task") {
    return;
  }

  const fund = findFundById(selectedFundId);
  if (!fund) {
    return;
  }

  const run = findWorkflowRunById(fund, target.dataset.runId);
  if (!run) {
    return;
  }

  openTaskDetail(run.id, target.dataset.taskId);
});

myTasksTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.dataset.action !== "open-my-task") {
    return;
  }

  selectedFundId = target.dataset.fundId || null;
  openTaskDetail(target.dataset.runId, target.dataset.taskId, Screen.MY_TASKS);
});

myTasksOwnerFilter.addEventListener("input", () => {
  myTasksFilters.ownerUserId = myTasksOwnerFilter.value;
  paginationState.myTasks = 1;
  renderMyTasks();
});

myTasksStatusFilter.addEventListener("input", () => {
  myTasksFilters.status = myTasksStatusFilter.value;
  paginationState.myTasks = 1;
  renderMyTasks();
});

myTasksFundFilter.addEventListener("input", () => {
  myTasksFilters.fundId = myTasksFundFilter.value;
  paginationState.myTasks = 1;
  renderMyTasks();
});

taskAttachmentTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.dataset.action !== "delete-task-attachment") {
    return;
  }

  if (!taskDetailDraft) {
    return;
  }

  const index = Number(target.dataset.attachmentIndex);
  if (Number.isNaN(index)) {
    return;
  }

  const [removedAttachment] = taskDetailDraft.attachments.splice(index, 1);
  if (!removedAttachment) {
    return;
  }

  renderTaskAttachmentRows();
});

taskAttachmentInput.addEventListener("change", async () => {
  if (!taskDetailDraft) {
    return;
  }

  const files = Array.from(taskAttachmentInput.files || []);
  for (const file of files) {
    try {
      const uploaded = await uploadAttachmentFile(file);
      taskDetailDraft.attachments.push({
        id: crypto.randomUUID(),
        uploadId: uploaded.id,
        name: uploaded.name,
        url: uploaded.url,
        storageKey: uploaded.storageKey,
        uploadedByUserId: currentUserId || "",
        uploadedAt: uploaded.uploadedAt || new Date().toISOString(),
        sizeBytes: uploaded.sizeBytes
      });
    } catch (error) {
      console.error("Attachment upload failed", error);
      alert(`Soubor ${file.name} se nepodarilo nahrat.`);
    }
  }

  taskAttachmentInput.value = "";
  renderTaskAttachmentRows();
});

saveTaskDetailButton.addEventListener("click", async () => {
  const selected = findSelectedRunTask();
  if (!selected || !taskDetailDraft) {
    return;
  }

  const { fund, run, task } = selected;
  const removedUploadIds = getRemovedTaskDetailUploadIds();
  task.status = taskDetailDraft.status;
  task.note = taskDetailDraft.note;
  task.attachments = cloneAttachments(taskDetailDraft.attachments);
  taskDetailOriginalAttachments = cloneAttachments(task.attachments);

  if (run.status === WorkflowRunStatus.SCHEDULED) {
    run.status = WorkflowRunStatus.RUNNING;
  }

  const workflow = findWorkflowById(run.workflowId);
  if (workflow) {
    materializeFollowUpTasks(run, workflow, new Date().toISOString());
  }
  recomputeWorkflowRunStatus(run);

  persistAppState();
  renderFundWorkflowRuns(fund);
  renderTaskDetail();
  await deleteUploadedAttachments(removedUploadIds);
});

taskDetailStatusSelect.addEventListener("input", () => {
  if (!taskDetailDraft) {
    return;
  }
  taskDetailDraft.status = taskDetailStatusSelect.value;
});

taskDetailNoteInput.addEventListener("input", () => {
  if (!taskDetailDraft) {
    return;
  }
  taskDetailDraft.note = taskDetailNoteInput.value;
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const enteredUser = usernameInput.value.trim();
  const enteredPassword = passwordInput.value;
  const user = users.find((row) => row.username === enteredUser && row.password === enteredPassword);

  if (!user) {
    setLoginError("Neplatne uzivatelske jmeno nebo heslo.");
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  if (!user.isActive) {
    setLoginError("Tento uzivatel je deaktivovany. Prihlaseni neni povoleno.");
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  currentUserId = user.id;
  resetMyTasksFilters();
  paginationState.myTasks = 1;
  clearLoginError();
  showAuthenticatedApp();
  setActiveScreen(Screen.MY_TASKS);
});

cancelDialogButton.addEventListener("click", () => {
  addFundDialog.close();
});

addFundForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const fundName = fundNameInput.value.trim();
  if (!fundName) {
    fundNameInput.focus();
    return;
  }

  funds.push({
    id: crypto.randomUUID(),
    name: fundName,
    status: FundStatus.ONBOARDING,
    workflowRuns: []
  });

  persistAppState();
  renderFunds();
  addFundDialog.close();
});

cancelUserDialogButton.addEventListener("click", () => {
  userDialog.close();
});

userForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = newUsernameInput.value.trim();
  const password = newPasswordInput.value.trim();

  if (!username || !password) {
    showUserDialogError("Uzivatelske jmeno i heslo jsou povinne.");
    return;
  }

  const duplicateUser = users.find(
    (user) => user.username.toLowerCase() === username.toLowerCase() && user.id !== editingUserId
  );

  if (duplicateUser) {
    showUserDialogError("Uzivatelske jmeno uz existuje.");
    return;
  }

  if (editingUserId) {
    const user = findUserById(editingUserId);
    if (!user) {
      return;
    }

    user.username = username;
    user.password = password;
  } else {
    users.push({
      id: crypto.randomUUID(),
      username,
      password,
      isActive: true
    });
  }

  persistAppState();
  renderUsers();
  renderWorkflowDetail();
  userDialog.close();
});

cancelWorkflowDialogButton.addEventListener("click", () => {
  workflowDialog.close();
});

workflowForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const workflowName = workflowNameInput.value.trim();
  if (!workflowName) {
    workflowDialogError.textContent = "Nazev workflow je povinny.";
    workflowDialogError.classList.remove("hidden");
    return;
  }

  const duplicateWorkflow = workflows.find(
    (workflow) => workflow.name.toLowerCase() === workflowName.toLowerCase()
  );

  if (duplicateWorkflow) {
    workflowDialogError.textContent = "Nazev workflow uz existuje.";
    workflowDialogError.classList.remove("hidden");
    return;
  }

  workflows.push(createWorkflow(workflowName));
  persistAppState();
  renderWorkflows();
  workflowDialog.close();
});

workflowDetailNameInput.addEventListener("input", (event) => {
  const workflow = getSelectedWorkflow();
  if (!workflow) {
    return;
  }

  workflow.name = event.target.value.trim() || "Workflow";
  workflowDetailTitle.textContent = `Detail workflow: ${workflow.name}`;
  persistAppState();
  renderWorkflows();
});

addDelayItemButton.addEventListener("click", () => addWorkflowItem(WorkflowItemType.DELAY));
addTaskItemButton.addEventListener("click", () => addWorkflowItem(WorkflowItemType.TASK));
addTaskGroupItemButton.addEventListener("click", () => addWorkflowItem(WorkflowItemType.TASK_GROUP));

workflowItemsContainer.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  const workflow = getSelectedWorkflow();
  if (!workflow) {
    return;
  }

  const itemId = target.dataset.itemId;
  const item = itemId ? findWorkflowItemById(workflow, itemId) : null;

  if (action === "remove-item" && item) {
    workflow.items = workflow.items.filter((row) => row.id !== item.id);
    workflow.items.forEach((row) => {
      if (row.type === WorkflowItemType.TASK && row.taskGroupId === item.id) {
        row.taskGroupId = "";
      }
      row.followUpTaskIds = (row.followUpTaskIds || []).filter((followUpId) => followUpId !== item.id);
    });
    persistAppState();
    renderWorkflowDetail();
    return;
  }

  if (action === "move-up" && item) {
    const index = workflow.items.findIndex((row) => row.id === item.id);
    if (index > 0) {
      [workflow.items[index - 1], workflow.items[index]] = [workflow.items[index], workflow.items[index - 1]];
      persistAppState();
      renderWorkflowDetail();
    }
    return;
  }

  if (action === "move-down" && item) {
    const index = workflow.items.findIndex((row) => row.id === item.id);
    if (index >= 0 && index < workflow.items.length - 1) {
      [workflow.items[index], workflow.items[index + 1]] = [workflow.items[index + 1], workflow.items[index]];
      persistAppState();
      renderWorkflowDetail();
    }
    return;
  }

  if (action === "add-followup-task" && item) {
    item.followUpTaskIds = item.followUpTaskIds || [];
    item.followUpTaskIds.push("");
    persistAppState();
    renderWorkflowDetail();
    return;
  }

  if (action === "remove-followup-task" && item) {
    const followupIndex = Number(target.dataset.followupIndex);
    if (!Number.isNaN(followupIndex)) {
      item.followUpTaskIds.splice(followupIndex, 1);
      persistAppState();
      renderWorkflowDetail();
    }
    return;
  }
});

workflowItemsContainer.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    return;
  }

  const workflow = getSelectedWorkflow();
  if (!workflow) {
    return;
  }

  const itemId = target.dataset.itemId;
  const item = itemId ? findWorkflowItemById(workflow, itemId) : null;

  if ((action === "item-name" || action === "delay-days" || action.startsWith("task-") || action === "followup-task-id") && !item) {
    return;
  }

  if (action === "item-name" && target instanceof HTMLInputElement) {
    item.name = target.value;
    persistAppState();
    renderWorkflows();
    return;
  }

  if (action === "delay-days" && target instanceof HTMLInputElement && item.type === WorkflowItemType.DELAY) {
    const numeric = Number(target.value);
    item.delayDays = Number.isNaN(numeric) ? 0 : Math.max(0, numeric);
    persistAppState();
    return;
  }

  if (action === "task-assignee" && target instanceof HTMLSelectElement && item.type === WorkflowItemType.TASK) {
    item.assigneeUserId = target.value;
    persistAppState();
    return;
  }

  if (action === "task-status" && target instanceof HTMLSelectElement && item.type === WorkflowItemType.TASK) {
    item.status = target.value;
    persistAppState();
    return;
  }

  if (action === "task-group-id" && target instanceof HTMLSelectElement && item.type === WorkflowItemType.TASK) {
    item.taskGroupId = target.value;
    persistAppState();
    return;
  }

  if (action === "task-deadline-offset" && target instanceof HTMLInputElement && item.type === WorkflowItemType.TASK) {
    const numeric = Number(target.value);
    item.deadlineOffsetDays = Number.isNaN(numeric) ? 0 : Math.max(0, numeric);
    persistAppState();
    return;
  }

  if (action === "followup-task-id" && target instanceof HTMLSelectElement) {
    const followupIndex = Number(target.dataset.followupIndex);
    if (!Number.isNaN(followupIndex) && item.followUpTaskIds[followupIndex] !== undefined) {
      item.followUpTaskIds[followupIndex] = target.value;
      persistAppState();
    }
    return;
  }
});

wirePagination(fundsPagination);
wirePagination(myTasksPagination);
wirePagination(usersPagination);
wirePagination(workflowsPagination);
wirePagination(fundRunsPagination);
wirePagination(runTasksPagination);
wirePagination(attachmentsPagination);

async function initializeApp() {
  const loadedState = await loadAppStateFromApi();
  applyLoadedState(loadedState);

  renderFunds();
  renderUsers();
  renderWorkflows();
  setActiveScreen(Screen.FUNDS);
}

initializeApp();
