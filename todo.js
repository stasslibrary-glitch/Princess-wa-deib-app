
// ======================================================
// PRINCESS WA DEIB — SHARED TO-DO LIST
// Firebase Authentication + Cloud Firestore
// ======================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ------------------------------------------------------
// ELEMENTS
// ------------------------------------------------------

const monthSelect = document.getElementById("month-select");
const yearSelect = document.getElementById("year-select");
const monthSelectorWrap = document.getElementById("month-selector-wrap");

const todoForm = document.getElementById("todo-form");
const taskTitleInput = document.getElementById("task-title");
const taskDescriptionInput = document.getElementById("task-description");
const taskDueDateInput = document.getElementById("task-due-date");
const addTaskButton = document.getElementById("add-task-button");
const formMessage = document.getElementById("form-message");

const tasksList = document.getElementById("tasks-list");
const taskCount = document.getElementById("task-count");
const tasksHeadingTitle = document.getElementById("tasks-heading-title");
const periodCaption = document.getElementById("period-caption");

const progressTitle = document.getElementById("progress-title");
const progressPercent = document.getElementById("progress-percent");
const progressFill = document.getElementById("progress-fill");
const completedCount = document.getElementById("completed-count");
const remainingCount = document.getElementById("remaining-count");

// ------------------------------------------------------
// STATE
// ------------------------------------------------------

let currentUser = null;
let allTasks = [];
let currentPeriod = "month";
let currentFilter = "all";
let unsubscribeTasks = null;
let isSubmitting = false;

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const now = new Date();
let selectedMonth = now.getMonth() + 1;
let selectedYear = now.getFullYear();

// ------------------------------------------------------
// INITIALISE PERIOD SELECTORS
// ------------------------------------------------------

function initialiseSelectors() {
  monthSelect.innerHTML = "";

  MONTHS.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  // Include previous and upcoming years.
  yearSelect.innerHTML = "";

  for (let year = now.getFullYear() - 5;
       year <= now.getFullYear() + 5;
       year++) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  }

  monthSelect.value = String(selectedMonth);
  yearSelect.value = String(selectedYear);
}

initialiseSelectors();

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function getPeriodKey() {
  if (currentPeriod === "month") {
    return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  }

  return String(selectedYear);
}

function getPeriodLabel() {
  if (currentPeriod === "month") {
    return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  }

  return String(selectedYear);
}

function getDisplayName(user) {
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }

  const email = (user.email || "").toLowerCase();

  if (email === "princess@gmail.com") return "Hubby 💜";
  if (email === "deib@gmail.com") return "Baby ❤️";

  return email || "Our account";
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.color = isError ? "#c13c6a" : "#7953a8";
}

function createElement(tag, className, text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function friendlyError(error) {
  console.error("PD To-Do List error:", error);

  if (error.code === "permission-denied") {
    return "Firebase denied access. Check the todoTasks Firestore rules.";
  }

  if (error.code === "unavailable") {
    return "Connection problem. Check your internet and try again.";
  }

  if (error.code === "unauthenticated") {
    return "Please sign in again to use our shared list.";
  }

  return "Something went wrong. Please try again.";
}

// ------------------------------------------------------
// SELECT MONTHLY OR YEARLY
// ------------------------------------------------------

document.querySelectorAll(".period-button").forEach(button => {
  button.addEventListener("click", () => {
    currentPeriod = button.dataset.period;

    document.querySelectorAll(".period-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    monthSelectorWrap.hidden = currentPeriod === "year";

    updatePeriodLabels();
    renderTasks();
  });
});

monthSelect.addEventListener("change", () => {
  selectedMonth = Number(monthSelect.value);
  updatePeriodLabels();
  renderTasks();
});

yearSelect.addEventListener("change", () => {
  selectedYear = Number(yearSelect.value);
  updatePeriodLabels();
  renderTasks();
});

function updatePeriodLabels() {
  const label = getPeriodLabel();

  periodCaption.textContent =
    currentPeriod === "month"
      ? `Our plans for ${label}`
      : `Our plans for the year ${label}`;

  tasksHeadingTitle.textContent =
    currentPeriod === "month"
      ? "Our monthly tasks"
      : "Our yearly tasks";

  progressTitle.textContent =
    currentPeriod === "month"
      ? "Our monthly progress"
      : "Our yearly progress";
}

// ------------------------------------------------------
// FILTER TABS
// ------------------------------------------------------

document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();
  });
});

// ------------------------------------------------------
// LOAD SHARED TASKS
// Both approved users see the same collection.
// We filter the selected month/year in the browser.
// ------------------------------------------------------

function listenForTasks() {
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  tasksList.innerHTML = "";

  const loading = createElement("div", "loading-state");
  const icon = createElement("i", "fa-solid fa-heart fa-beat");
  const message = createElement("p", "", "Loading our little plans...");

  loading.append(icon, message);
  tasksList.appendChild(loading);

  unsubscribeTasks = onSnapshot(
    collection(db, "todoTasks"),
    snapshot => {
      allTasks = snapshot.docs.map(taskDoc => ({
        id: taskDoc.id,
        ...taskDoc.data()
      }));

      renderTasks();
    },
    error => {
      console.error("Could not load shared tasks:", error);

      tasksList.innerHTML = "";

      const errorBox = createElement("div", "error-state");
      const errorMessage = createElement("p", "", friendlyError(error));

      errorBox.appendChild(errorMessage);
      tasksList.appendChild(errorBox);
    }
  );
}

// ------------------------------------------------------
// PROGRESS DISPLAY
// ------------------------------------------------------

function updateProgress(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(task => task.done === true).length;
  const remaining = total - completed;

  const percentage = total === 0
    ? 0
    : Math.round((completed / total) * 100);

  progressPercent.textContent = `${percentage}%`;
  progressFill.style.width = `${percentage}%`;

  completedCount.textContent = String(completed);
  remainingCount.textContent = String(remaining);

  if (total > 0 && completed === total) {
    progressTitle.textContent = "We did it together! 🎉";
  } else if (completed > 0) {
    progressTitle.textContent = "Look at us making progress! 💗";
  } else {
    progressTitle.textContent = "Every little step counts!";
  }
}

// ------------------------------------------------------
// RENDER TASKS
// ------------------------------------------------------

function renderTasks() {
  updatePeriodLabels();

  const periodKey = getPeriodKey();

  let tasks = allTasks.filter(task =>
    task.periodType === currentPeriod &&
    task.periodKey === periodKey
  );

  // Newest tasks first.
  tasks.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  updateProgress(tasks);

  let visibleTasks = tasks;

  if (currentFilter === "pending") {
    visibleTasks = tasks.filter(task => task.done !== true);
  } else if (currentFilter === "completed") {
    visibleTasks = tasks.filter(task => task.done === true);
  }

  taskCount.textContent =
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  tasksList.innerHTML = "";

  if (visibleTasks.length === 0) {
    const empty = createElement("div", "empty-state");
    const icon = createElement("div", "empty-icon", "💗");
    const heading = createElement(
      "h3",
      "",
      tasks.length === 0
        ? "Our list is waiting!"
        : "Nothing to show here"
    );

    const description = createElement(
      "p",
      "",
      tasks.length === 0
        ? "Add our first plan for this period above."
        : "Try another filter to see your tasks."
    );

    empty.append(icon, heading, description);
    tasksList.appendChild(empty);
    return;
  }

  visibleTasks.forEach(task => {
    tasksList.appendChild(buildTaskCard(task));
  });
}

// ------------------------------------------------------
// BUILD EACH TASK CARD
// ------------------------------------------------------

function buildTaskCard(task) {
  const card = createElement(
    "article",
    `task-card${task.done ? " is-completed" : ""}`
  );

  const main = createElement("div", "task-main");

  const checkbox = createElement("input", "task-checkbox");
  checkbox.type = "checkbox";
  checkbox.checked = task.done === true;
  checkbox.setAttribute(
    "aria-label",
    task.done ? "Mark task as pending" : "Mark task as completed"
  );

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;

    try {
      await updateDoc(doc(db, "todoTasks", task.id), {
        done: checkbox.checked,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      alert(friendlyError(error));
    } finally {
      checkbox.disabled = false;
    }
  });

  const content = createElement("div", "task-content");
  const title = createElement("h3", "task-title", task.title || "Untitled task");

  content.appendChild(title);

  if (task.description) {
    content.appendChild(
      createElement("p", "task-description", task.description)
    );
  }

  main.append(checkbox, content);
  card.appendChild(main);

  const meta = createElement("div", "task-meta");

  const creator = createElement(
    "span",
    "meta-pill",
    `♡ Added by ${task.createdByName || "Your partner"}`
  );

  meta.appendChild(creator);

  if (task.dueDate) {
    const due = createElement(
      "span",
      "meta-pill due",
      `📅 Due ${formatDate(task.dueDate)}`
    );

    meta.appendChild(due);
  }

  if (task.done) {
    meta.appendChild(
      createElement("span", "meta-pill done", "✓ Completed")
    );
  }

  card.appendChild(meta);

  const actions = createElement("div", "task-actions");

  const editButton = createElement("button", "task-action");
  editButton.type = "button";
  editButton.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';

  editButton.addEventListener("click", async () => {
    const newTitle = prompt("Edit task title:", task.title || "");

    if (newTitle === null) return;

    const cleanTitle = newTitle.trim();

    if (!cleanTitle) {
      alert("The task title cannot be empty.");
      return;
    }

    const newDescription = prompt(
      "Edit task details (leave blank for none):",
      task.description || ""
    );

    if (newDescription === null) return;

    try {
      editButton.disabled = true;

      await updateDoc(doc(db, "todoTasks", task.id), {
        title: cleanTitle,
        description: newDescription.trim(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      alert(friendlyError(error));
    } finally {
      editButton.disabled = false;
    }
  });

  const deleteButton = createElement("button", "task-action delete");
  deleteButton.type = "button";
  deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';

  deleteButton.addEventListener("click", async () => {
    const confirmed = confirm(
      `Delete "${task.title}" from your shared list? Both of you will lose this task.`
    );

    if (!confirmed) return;

    try {
      deleteButton.disabled = true;
      await deleteDoc(doc(db, "todoTasks", task.id));
    } catch (error) {
      alert(friendlyError(error));
      deleteButton.disabled = false;
    }
  });

  actions.append(editButton, deleteButton);
  card.appendChild(actions);

  return card;
}

// ------------------------------------------------------
// ADD A TASK
// ------------------------------------------------------

todoForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    setMessage("Please sign in before adding a task.", true);
    return;
  }

  if (isSubmitting) return;

  const title = taskTitleInput.value.trim();
  const description = taskDescriptionInput.value.trim();
  const dueDate = taskDueDateInput.value;

  if (!title) {
    setMessage("Please enter a task title.", true);
    taskTitleInput.focus();
    return;
  }

  isSubmitting = true;
  addTaskButton.disabled = true;
  addTaskButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Adding task...';

  try {
    await addDoc(collection(db, "todoTasks"), {
      title,
      description,
      dueDate,
      periodType: currentPeriod,
      periodKey: getPeriodKey(),
      done: false,
      createdByUID: currentUser.uid,
      createdByName: getDisplayName(currentUser),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    todoForm.reset();
    setMessage("Added to our list successfully! 💗");

  } catch (error) {
    setMessage(friendlyError(error), true);

  } finally {
    isSubmitting = false;
    addTaskButton.disabled = false;
    addTaskButton.innerHTML =
      '<i class="fa-solid fa-heart"></i> Add to our list';
  }
});

// ------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------

onAuthStateChanged(auth, user => {
  if (!user) {
    currentUser = null;

    if (unsubscribeTasks) {
      unsubscribeTasks();
      unsubscribeTasks = null;
    }

    tasksList.innerHTML = "";

    const errorBox = createElement("div", "error-state");
    errorBox.appendChild(
      createElement("p", "", "Please sign in to open your shared To-Do List.")
    );

    tasksList.appendChild(errorBox);
    return;
  }

  currentUser = user;
  listenForTasks();
});
